// Spectrum Waterfall (RX-only in Stage A / Tier 1-2).
//
// LIVE: `rtl_tcp` or SoapySDR streams IQ; run an FFT (e.g. via `rtl_power` for a
// cheap sweep, or a DSP lib) and forward power-per-bin. RX is legal everywhere;
// TX is gated by the scope gate to registry bands + jurisdiction and is NOT
// possible on RX-only RTL-SDR hardware.
const MODE = process.env.INTEGRATION_MODE || 'mock';

// One FFT row: N bins of power in dBFS, with a couple of synthetic carriers.
export function sweepRow(centerHz = 433920000, bins = 96, t = 0) {
  if (MODE === 'live') {
    // Placeholder: real rows arrive from rtl_power/SoapySDR here.
  }
  const row = new Array(bins);
  const c1 = Math.floor(bins * 0.35);
  const c2 = Math.floor(bins * 0.7);
  for (let i = 0; i < bins; i++) {
    let noise = -95 + Math.sin(i * 0.3 + t * 0.2) * 3 - Math.abs(((i * 7 + t) % 11) - 5);
    const burst = (t % 20 < 3) ? Math.exp(-((i - c1) ** 2) / 6) * 45 : 0;
    const beacon = Math.exp(-((i - c2) ** 2) / 3) * (25 + Math.sin(t * 0.5) * 8);
    row[i] = Math.max(-110, Math.min(-10, noise + burst + beacon));
  }
  return { centerHz, bins, t, row };
}
