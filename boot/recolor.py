#!/usr/bin/env python3
"""
1:1 recolor of the DedSec source logo into the ctOS palette.

Takes YOUR image and remaps colours pixel-for-pixel — the artwork, dither, and
every edge stay exactly as drawn. Nothing is redrawn.

  purple / coloured background  ->  black + dark grey bands
  white / light art (figure+tag) ->  light grey
  the skull                      ->  NEON RED

Usage:
    python3 boot/recolor.py boot/source-logo.png
    python3 boot/recolor.py boot/source-logo.png --skull x,y,w,h   # exact skull box
    python3 boot/recolor.py boot/source-logo.png --no-skull        # skip red pass

Writes:
    boot/grub/dedsec/background.png        (1920x1080, centred on black)
    boot/greeter/sddm-dedsec/background.png
    public/dedsec-logo.png                 (trimmed, used by the dashboard boot)
"""
import sys, os, colorsys
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ctOS palette
BG_DARK   = (10, 13, 16)     # background base
BG_BAND   = (23, 28, 33)     # the lighter scanline band
ART_LIGHT = (233, 237, 238)  # the white/dithered artwork
ART_MID   = (150, 156, 158)
SKULL_RED = (255, 26, 53)    # neon red — skull only
SKULL_DK  = (141, 0, 22)


def luma(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def is_coloured(p, sat_thresh=0.25):
    """True for saturated pixels (the purple field) — greys/whites are not."""
    h, l, s = colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)
    return s > sat_thresh


def recolor(src_path, skull_box=None, do_skull=True):
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    px = im.load()

    out = Image.new("RGB", (w, h))
    o = out.load()

    for y in range(h):
        for x in range(w):
            p = px[x, y]
            L = luma(p)
            if is_coloured(p):
                # background field: keep its banding by using its own luma
                t = L / 255.0
                o[x, y] = tuple(
                    int(BG_DARK[i] + (BG_BAND[i] - BG_DARK[i]) * min(1.0, t * 1.9))
                    for i in range(3)
                )
            else:
                # artwork: greyscale, preserving the 1-bit dither exactly
                if L > 140:
                    o[x, y] = ART_LIGHT
                elif L > 70:
                    o[x, y] = ART_MID
                else:
                    o[x, y] = BG_DARK

    if do_skull and skull_box:
        x0, y0, bw, bh = skull_box
        for y in range(max(0, y0), min(h, y0 + bh)):
            for x in range(max(0, x0), min(w, x0 + bw)):
                p = o[x, y]
                L = luma(p)
                if L > 140:
                    o[x, y] = SKULL_RED       # skull body -> neon red
                elif L > 70:
                    o[x, y] = SKULL_DK        # its dither -> deep red
                # dark pixels (eyes/nose/teeth) stay black

    return out


def frame(img, size=(1920, 1080), scale=0.62):
    """Centre the logo on a black canvas at the given size."""
    canvas = Image.new("RGB", size, BG_DARK)
    tw = int(size[0] * scale)
    th = int(img.height * (tw / img.width))
    if th > size[1] * 0.8:
        th = int(size[1] * 0.8)
        tw = int(img.width * (th / img.height))
    r = img.resize((tw, th), Image.LANCZOS)
    canvas.paste(r, ((size[0] - tw) // 2, (size[1] - th) // 2))
    return canvas


def main():
    args = [a for a in sys.argv[1:]]
    if not args:
        print(__doc__)
        sys.exit(1)
    src = args[0]
    if not os.path.exists(src):
        print(f"source image not found: {src}")
        sys.exit(1)

    skull_box = None
    do_skull = "--no-skull" not in args
    if "--skull" in args:
        v = args[args.index("--skull") + 1]
        skull_box = tuple(int(n) for n in v.split(","))

    img = Image.open(src)
    print(f"source: {src}  {img.size[0]}x{img.size[1]}")

    out = recolor(src, skull_box, do_skull)

    logo_p = os.path.join(ROOT, "public", "dedsec-logo.png")
    out.save(logo_p)
    print(f"wrote {logo_p}")

    bg = frame(out)
    for p in (
        os.path.join(ROOT, "boot", "grub", "dedsec", "background.png"),
        os.path.join(ROOT, "boot", "greeter", "sddm-dedsec", "background.png"),
    ):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        bg.save(p)
        print(f"wrote {p}  1920x1080")


if __name__ == "__main__":
    main()
