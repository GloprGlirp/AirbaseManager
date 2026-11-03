// ---------- Pixel look: low-res window view, limited muted palette, ordered dithering ----------
const PALETTE = [
  '#0f0c0a', '#1e1915', '#2e2620', '#40352c', '#54473a', '#6b5c4a', '#85745d', '#a08e72', '#bba98a', '#d4c4a2', '#ece0c2',
  '#141a20', '#1f2a33', '#2d3c47', '#3f525e', '#566b76', '#70878f', '#8da3a8', '#aebfc0', '#cdd8d6',
  '#4a4a46', '#6e6e68', '#94948c', '#bcbcb2',
  '#252c1c', '#343f26', '#465432', '#5c6b40', '#76844f', '#86b866',
  '#4a1f19', '#7a2e1f', '#a3412a', '#c8653a', '#e09a52',
  '#b8902e', '#e6c25a', '#f4e3a0', '#5f7fc0',
];
const PAL = PALETTE.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v / 16 - 0.47) * 14);
let LUT = null;
function buildLUT() {
  LUT = new Uint8Array(32768);
  for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
    const R = r * 8 + 4, Gc = g * 8 + 4, B = b * 8 + 4;
    let best = 0, bd = 1e12;
    for (let i = 0; i < PAL.length; i++) {
      const p = PAL[i], dr = R - p[0], dg = Gc - p[1], db = B - p[2], d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < bd) { bd = d; best = i; }
    }
    LUT[(r << 10) | (g << 5) | b] = best;
  }
}
function quantize() {
  if (!LUT) buildLUT();
  const w = cv.width, h = cv.height; if (!w || !h) return;
  const img = cx.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const row = (y & 3) * 4;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, t = BAYER[row + (x & 3)];
      let r = d[i] + t, g = d[i + 1] + t, b = d[i + 2] + t;
      r = r < 0 ? 0 : r > 255 ? 31 : r >> 3; g = g < 0 ? 0 : g > 255 ? 31 : g >> 3; b = b < 0 ? 0 : b > 255 ? 31 : b >> 3;
      const p = PAL[LUT[(r << 10) | (g << 5) | b]];
      d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
    }
  }
  cx.putImageData(img, 0, 0);
}
