#!/usr/bin/env python3
"""
1:1 recolor of a DedSec source image into the ctOS palette.

The artwork is NOT redrawn. Every pixel keeps its original luminance
relationship, so all dither, glitch streaks and edges survive exactly; only the
colours are remapped:

    black .......... #060809   (ctOS background)
    greys/whites ... grey ramp up to #eef1f2
    the skull ...... NEON RED ramp (elliptical mask, soft edge)

Usage
    python3 boot/recolor.py SRC --out NAME [options]

    --skull cx,cy,rx,ry   ellipse (source px) whose bright pixels turn neon red
    --contrast F          luma contrast boost, default 1.25
    --bg                  also emit a 1920x1080 background (centred on black)
    --scale F             logo size on that background, default 0.66

Examples
    python3 boot/recolor.py "boot/images.jpg" --out dedsec-logo \
        --skull 312,105,30,29 --bg
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BG        = (6, 8, 9)        # darkest
GREY_HI   = (238, 241, 242)  # brightest
RED_HI    = (255, 26, 53)    # neon red
RED_MID   = (150, 0, 24)


def luma_map(src, contrast=1.25):
    """Greyscale the image and remap luma onto the ctOS grey ramp, 1:1."""
    g = src.convert("L")
    # contrast around mid-grey, keeps the 1-bit crunch of the original dither
    g = g.point(lambda v: max(0, min(255, int((v - 128) * contrast + 128))))
    out = Image.new("RGB", src.size)
    o, gp = out.load(), g.load()
    w, h = src.size
    for y in range(h):
        for x in range(w):
            t = gp[x, y] / 255.0
            o[x, y] = tuple(int(BG[i] + (GREY_HI[i] - BG[i]) * t) for i in range(3))
    return out, g


def apply_skull(img, grey, ellipse, feather=6):
    """Turn the bright pixels inside `ellipse` into a neon-red ramp."""
    cx, cy, rx, ry = ellipse
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather))  # soft edge, no seam

    o, gp, mp = img.load(), grey.load(), mask.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            m = mp[x, y] / 255.0
            if m <= 0.003:
                continue
            t = gp[x, y] / 255.0
            # red ramp: dark stays black, bright -> neon red
            if t < 0.5:
                k = t * 2
                red = tuple(int(BG[i] + (RED_MID[i] - BG[i]) * k) for i in range(3))
            else:
                k = (t - 0.5) * 2
                red = tuple(int(RED_MID[i] + (RED_HI[i] - RED_MID[i]) * k) for i in range(3))
            cur = o[x, y]
            o[x, y] = tuple(int(cur[i] + (red[i] - cur[i]) * m) for i in range(3))
    return img


def scrim(img, start=0.5, strength=0.86):
    """Fade the frame toward black from `start` (0-1) downward, so overlaid
    menu/login text stays readable over bright artwork."""
    w, h = img.size
    o = img.load()
    y0 = int(h * start)
    for y in range(y0, h):
        k = (y - y0) / max(1, (h - y0))          # 0 at start -> 1 at bottom
        f = 1.0 - strength * (k ** 1.4)
        for x in range(w):
            r, g, b = o[x, y]
            o[x, y] = (int(r * f), int(g * f), int(b * f))
    return img


def cover(img, size=(1920, 1080)):
    """Scale to fill the frame, cropping the overflow (for wallpapers)."""
    sw, sh = img.size
    k = max(size[0] / sw, size[1] / sh)
    r = img.resize((int(sw * k + 0.5), int(sh * k + 0.5)), Image.LANCZOS)
    x = (r.width - size[0]) // 2
    y = (r.height - size[1]) // 2
    return r.crop((x, y, x + size[0], y + size[1]))


def frame(img, size=(1920, 1080), scale=0.66):
    canvas = Image.new("RGB", size, BG)
    tw = int(size[0] * scale)
    th = int(img.height * (tw / img.width))
    if th > size[1] * 0.82:
        th = int(size[1] * 0.82)
        tw = int(img.width * (th / img.height))
    canvas.paste(img.resize((tw, th), Image.LANCZOS),
                 ((size[0] - tw) // 2, (size[1] - th) // 2))
    return canvas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--out", required=True, help="basename written to public/")
    ap.add_argument("--skull", help="cx,cy,rx,ry ellipse in source pixels")
    ap.add_argument("--contrast", type=float, default=1.25)
    ap.add_argument("--feather", type=int, default=6)
    ap.add_argument("--bg", action="store_true", help="also write the 1920x1080 backgrounds")
    ap.add_argument("--bg-out", action="append", default=[],
                    help="repo-relative path for a 1920x1080 background (repeatable). "
                         "Without it, --bg writes both the GRUB and SDDM backgrounds.")
    ap.add_argument("--cover", action="store_true",
                    help="fill the whole 1920x1080 frame (crop to fit) instead of centring")
    ap.add_argument("--scale", type=float, default=0.66)
    ap.add_argument("--scrim", type=float, default=None,
                    help="darken the frame from this height fraction downward (e.g. 0.5) "
                         "so overlaid menu/login text stays readable")
    a = ap.parse_args()

    src = Image.open(a.src).convert("RGB")
    print(f"source: {a.src}  {src.size[0]}x{src.size[1]}")

    img, grey = luma_map(src, a.contrast)
    if a.skull:
        e = tuple(int(v) for v in a.skull.split(","))
        img = apply_skull(img, grey, e, a.feather)
        print(f"skull ellipse: centre=({e[0]},{e[1]}) radii=({e[2]},{e[3]}) -> neon red")

    logo = os.path.join(ROOT, "public", f"{a.out}.png")
    os.makedirs(os.path.dirname(logo), exist_ok=True)
    img.save(logo)
    print(f"wrote {logo}")

    if a.bg or a.bg_out:
        bgim = cover(img) if a.cover else frame(img, scale=a.scale)
        if a.scrim is not None:
            bgim = scrim(bgim, a.scrim)
        targets = [os.path.join(ROOT, p) for p in a.bg_out] or [
            os.path.join(ROOT, "boot", "grub", "dedsec", "background.png"),
            os.path.join(ROOT, "boot", "greeter", "sddm-dedsec", "background.png")]
        for p in targets:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            bgim.save(p)
            print(f"wrote {p}  1920x1080")


if __name__ == "__main__":
    main()
