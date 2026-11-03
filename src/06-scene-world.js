// ---------- Window view: sky, scenery, airfield ----------
const cv = $('#outside'), cx = cv.getContext('2d', { willReadFrequently: true });
let PX = 3;   // size of one screen pixel of the window view, in CSS px
let W = 300, H = 150, STARS = [], CLOUDS = [], TREES = [];
const G = { hz: 0.40, bld: 0.478, rwy: 0.575, rwyH: 0.046, twy: 0.69, twyH: 0.024, apr: 0.875 };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const shade = (c, k) => c.map(v => Math.round(v * k));
function ell(x, y, rx, ry) { cx.beginPath(); cx.ellipse(x, y, Math.max(0.0005, rx), Math.max(0.0005, ry), 0, 0, Math.PI * 2); cx.fill(); }
function poly(pts) { cx.beginPath(); pts.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.closePath(); cx.fill(); }
function gsc(y) { return Math.max(0.18, lerp(0.5, 1, (y - G.rwy) / (G.apr - G.rwy))); }
function UL() { return Math.min(W * 0.062, H * 0.21); }

function sizeScene() {
  const r = cv.getBoundingClientRect();
  W = Math.max(60, r.width); H = Math.max(60, r.height);
  // one art pixel = a whole number of device pixels, so the grid stays even
  const dpr = window.devicePixelRatio || 1;
  // 1 art pixel = 1 device pixel on normal screens, 2 on retina; buffer capped at 1400 px wide
  PX = Math.max((dpr >= 2 ? 2 : 1) / dpr, W / 1400);
  cv.width = Math.max(1, Math.round(W / PX)); cv.height = Math.max(1, Math.round(H / PX));
  cx.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
}
function initScenery() {
  let s = 7; const sr = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  STARS = Array.from({ length: 80 }, () => [sr(), sr() * 0.36, sr()]);
  TREES = Array.from({ length: 34 }, () => [sr(), 0.6 + sr() * 0.8]);
  CLOUDS = Array.from({ length: 8 }, () => ({ x: sr() * 1.3 - 0.15, y: 0.04 + sr() * 0.24, s: 0.6 + sr() * 0.9, v: 0.004 + sr() * 0.008 }));
}
function daylight() {
  const h = hourOf(S.t);
  if (h < 5 || h >= 20.5) return 0;
  if (h < 7) return (h - 5) / 2;
  if (h >= 18.5) return 1 - (h - 18.5) / 2;
  return 1;
}
function overcast() { return { clear: 0, cloudy: 0.55, rain: 0.85, fog: 0.7, storm: 1 }[S.wx.kind] || 0; }

function drawSky(L, gold, ov, dtR) {
  let top = mix([5, 8, 17], [70, 120, 168], L), bot = mix([15, 22, 38], [176, 201, 214], L);
  top = mix(top, [42, 52, 92], gold * 0.6); bot = mix(bot, [228, 148, 96], gold * 0.75);
  const gr = mix([20, 22, 26], [128, 136, 142], L);
  top = mix(top, gr, ov * 0.75); bot = mix(bot, gr, ov * 0.65);
  const g = cx.createLinearGradient(0, 0, 0, H * G.hz);
  g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(bot));
  cx.fillStyle = g; cx.fillRect(0, 0, W, H * G.hz + 2);
  if (L < 0.35 && ov < 0.6) {
    for (const st of STARS) { cx.fillStyle = `rgba(225,232,255,${((0.35 - L) / 0.35) * (1 - ov) * (0.35 + st[2] * 0.6)})`; cx.fillRect(st[0] * W, st[1] * H, PX, PX); }
  }
  const h = hourOf(S.t);
  if (h > 5.5 && h < 20) {           // sun
    const u = (h - 5.5) / 14.5, sx = lerp(0.92, 0.06, u) * W, sy = (G.hz - Math.sin(Math.PI * u) * 0.34) * H;
    const rg = cx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.22);
    rg.addColorStop(0, `rgba(255,236,190,${0.9 * (1 - ov * 0.8)})`); rg.addColorStop(0.08, `rgba(255,214,150,${0.5 * (1 - ov)})`); rg.addColorStop(1, 'rgba(255,200,140,0)');
    cx.fillStyle = rg; cx.fillRect(sx - H * 0.22, sy - H * 0.22, H * 0.44, H * 0.44);
  } else if (ov < 0.7) {             // moon
    const u = ((h + 4) % 24) / 9.5, mx = lerp(0.85, 0.15, clamp(u, 0, 1)) * W, my = (0.08 + Math.abs(u - 0.5) * 0.2) * H;
    cx.fillStyle = `rgba(226,230,240,${0.85 * (1 - ov)})`; ell(mx, my, H * 0.022, H * 0.022);
    cx.fillStyle = rgb(top); ell(mx + H * 0.009, my - H * 0.004, H * 0.02, H * 0.02);
  }
  const cc = mix(mix([50, 54, 68], [242, 242, 244], L), mix([30, 32, 36], [168, 172, 178], L), ov);
  const n = Math.round(4 + ov * 4);
  for (let i = 0; i < n; i++) {
    const c = CLOUDS[i];
    c.x += c.v * dtR * (0.4 + S.wx.kt / 14) * (S.speed ? 1 : 0.2);
    if (c.x > 1.25) c.x = -0.25;
    const x = c.x * W, y = c.y * H, r = c.s * W * 0.05 * (1 + ov * 0.6);
    cx.fillStyle = rgb(cc, 0.45 + ov * 0.45);
    ell(x, y, r * 1.6, r * 0.45); ell(x - r * 0.7, y + r * 0.08, r * 0.9, r * 0.35); ell(x + r * 0.5, y - r * 0.2, r * 0.8, r * 0.42);
  }
}

function drawFarSide(L, ov, now) {
  const haze = mix(mix([12, 16, 20], [96, 112, 118], L), mix([20, 22, 26], [140, 146, 150], L), ov * 0.6);
  cx.fillStyle = rgb(haze);
  cx.beginPath(); cx.moveTo(0, G.hz * H);
  for (let i = 0; i <= 40; i++) { const x = i / 40; cx.lineTo(x * W, (0.372 + Math.sin(i * 0.9) * 0.01 + Math.sin(i * 0.37 + 1) * 0.018) * H); }
  cx.lineTo(W, G.hz * H); cx.closePath(); cx.fill();
  const gTop = mix([18, 22, 22], [122, 132, 104], L), gBot = mix([12, 15, 14], [82, 98, 60], L);
  const g = cx.createLinearGradient(0, G.hz * H, 0, H);
  g.addColorStop(0, rgb(mix(gTop, haze, 0.3))); g.addColorStop(1, rgb(gBot));
  cx.fillStyle = g; cx.fillRect(0, G.hz * H, W, H * (1 - G.hz));
  const tree = mix([8, 11, 10], [52, 68, 50], L);
  cx.fillStyle = rgb(mix(tree, haze, 0.35));
  for (const t of TREES) ell(t[0] * W, G.hz * H + 1, W * 0.012 * t[1], H * 0.012 * t[1]);

  const k = 0.22 + 0.78 * L, base = G.bld * H, night = 1 - L;
  const box = (x, w, h, col) => { cx.fillStyle = rgb(shade(col, k)); cx.fillRect(x * W, base - h * H, w * W, h * H); };
  drawHangars(k, night, now, base);
  // ops building with window rows
  box(0.39, 0.105, 0.034, [150, 146, 136]);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) {
    cx.fillStyle = night > 0.3 && (i * 7 + r * 3) % 5 ? `rgba(255,214,150,${0.35 + night * 0.5})` : rgb(shade([60, 70, 78], k));
    cx.fillRect((0.397 + i * 0.0108) * W, base - (0.027 - r * 0.012) * H, W * 0.007, Math.max(PX, H * 0.006));
  }
  // control tower
  box(0.515, 0.012, 0.12, [160, 156, 146]);
  cx.fillStyle = rgb(shade([120, 118, 110], k)); cx.fillRect(0.504 * W, base - 0.152 * H, 0.034 * W, 0.006 * H);
  cx.fillStyle = night > 0.3 ? `rgba(120,200,190,${0.4 + night * 0.4})` : rgb(shade([46, 72, 80], k));
  cx.fillRect(0.506 * W, base - 0.146 * H, 0.03 * W, 0.024 * H);
  cx.fillStyle = rgb(shade([90, 92, 90], k)); cx.fillRect(0.504 * W, base - 0.124 * H, 0.034 * W, 0.004 * H);
  if (night > 0.2) { const on = (now / 900) % 2 < 1; cx.fillStyle = on ? 'rgba(120,255,150,.95)' : 'rgba(255,255,240,.95)'; ell(0.521 * W, base - 0.158 * H, PX, PX); }
  // radar head
  const rx = 0.578 * W;
  cx.fillStyle = rgb(shade([110, 112, 108], k)); cx.fillRect(rx - 2, base - 0.05 * H, 4, 0.05 * H);
  const span = Math.abs(Math.cos(now / 700)) * W * 0.016 + 1.5;
  cx.fillStyle = rgb(shade([190, 190, 184], k)); cx.fillRect(rx - span, base - 0.058 * H, span * 2, 0.007 * H);
  // fuel farm, tank tops tinted by stock level
  const lvl = S.res.fuel / capOf('fuel');
  for (const x of [0.86, 0.905, 0.95, 0.815, 0.77].slice(0, 3 + S.base.fuelfarm)) {
    box(x - 0.015, 0.03, 0.036, [176, 178, 172]);
    cx.fillStyle = rgb(shade([196, 198, 192], k)); ell(x * W, base - 0.036 * H, 0.015 * W, 0.004 * H);
    cx.fillStyle = rgb(shade([96, 100, 98], k)); cx.fillRect((x - 0.015) * W, base - 0.036 * H * lvl - 1, 0.03 * W, PX);
  }
}

function drawAirfield(L, now) {
  const k = 0.22 + 0.78 * L, night = 1 - L;
  const asph = shade([66, 68, 70], k), conc = shade([146, 146, 140], k), paint = `rgba(235,235,230,${0.35 + 0.4 * L})`;
  const ry0 = (G.rwy - G.rwyH / 2) * H, rh = G.rwyH * H;
  const ty0 = (G.twy - G.twyH / 2) * H, th = G.twyH * H;
  cx.fillStyle = rgb(asph);
  poly([[0.14 * W, ry0 + rh], [0.19 * W, ry0 + rh], [0.135 * W, ty0], [0.085 * W, ty0]]);
  poly([[0.93 * W, ry0 + rh], [0.97 * W, ry0 + rh], [0.89 * W, ty0], [0.85 * W, ty0]]);
  cx.fillRect(0, ry0, W, rh);
  cx.fillStyle = rgb(shade([74, 76, 76], k)); cx.fillRect(0, ty0, W, th);
  cx.fillStyle = paint;
  cx.fillRect(0, ry0 + PX, W, PX); cx.fillRect(0, ry0 + rh - 2 * PX, W, PX);
  for (let x = 0.08; x < 0.92; x += 0.05) cx.fillRect(x * W, ry0 + rh / 2 - PX / 2, 0.025 * W, PX);
  for (let i = 1; i < 7; i++) { cx.fillRect(0.936 * W, ry0 + rh * i / 7.5, 0.026 * W, PX); cx.fillRect(0.038 * W, ry0 + rh * i / 7.5, 0.026 * W, PX); }
  for (const x of [0.84, 0.8]) { cx.fillRect(x * W, ry0 + rh * 0.22, 0.02 * W, PX); cx.fillRect(x * W, ry0 + rh * 0.74, 0.02 * W, PX); }
  cx.fillStyle = `rgba(232,190,60,${0.4 + 0.4 * L})`; cx.fillRect(0, G.twy * H - PX / 2, W, PX);
  // apron and lead-in stubs
  const ay = 0.765 * H;
  cx.fillStyle = rgb(conc);
  for (const x of [...SPOTS, CARGO_SPOT]) cx.fillRect((x - 0.018) * W, ty0 + th, 0.036 * W, ay - ty0 - th + 1);
  cx.fillRect(0, ay, W, H - ay);
  cx.strokeStyle = rgb(shade([112, 112, 106], k)); cx.lineWidth = PX; cx.beginPath();
  for (let y = ay + 0.04 * H; y < H; y += 0.045 * H) { cx.moveTo(0, y); cx.lineTo(W, y); }
  for (let x = 0.035; x < 1; x += 0.07) { cx.moveTo(x * W, ay); cx.lineTo(x * W, H); }
  cx.stroke();
  cx.fillStyle = `rgba(232,190,60,${0.45 + 0.4 * L})`;
  cx.font = `${Math.round(Math.max(8, clamp(W * 0.011, 9, 14) / PX)) * PX}px "Silkscreen", monospace`; cx.textAlign = 'center';
  [...SPOTS, CARGO_SPOT].forEach((x, i) => {
    cx.fillRect(x * W - PX / 2, G.twy * H, PX, (G.apr - G.twy) * H);
    cx.fillRect((x - 0.02) * W, G.apr * H + 3, 0.04 * W, PX);
    cx.fillText(i < SPOTS.length ? pad2(i + 1) : 'C1', x * W, (G.apr + 0.07) * H);
  });
  if (S.t < S.runway.closedUntil) {          // runway closed: craters and X markers
    cx.fillStyle = 'rgba(18,16,14,.85)';
    for (const f of S.fx) if (f.kind === 'smoke' && f.at === 'rwy') ell(f.x * W, G.rwy * H, W * 0.022, rh * 0.32);
    cx.strokeStyle = 'rgba(245,210,70,.85)'; cx.lineWidth = PX;
    for (const x of [0.22, 0.6]) { cx.beginPath(); cx.moveTo(x * W - rh * 0.5, ry0 + 2); cx.lineTo(x * W + rh * 0.5, ry0 + rh - 2); cx.moveTo(x * W + rh * 0.5, ry0 + 2); cx.lineTo(x * W - rh * 0.5, ry0 + rh - 2); cx.stroke(); }
  }
  drawBaseExtras(L, k, now);
  if (night > 0.25) {
    const a = (night - 0.25) / 0.75;
    for (let x = 0.01; x < 1; x += 0.04) { cx.fillStyle = `rgba(255,240,200,${0.85 * a})`; cx.fillRect(x * W, ry0 - PX / 2, PX, PX); cx.fillRect(x * W, ry0 + rh - PX / 2, PX, PX); }
    for (let i = 0; i < 6; i++) { cx.fillStyle = `rgba(90,255,140,${a})`; cx.fillRect(0.972 * W, ry0 + rh * i / 5 - PX / 2, PX, PX); cx.fillStyle = `rgba(255,70,60,${a})`; cx.fillRect(0.012 * W, ry0 + rh * i / 5 - PX / 2, PX, PX); }
    for (let x = 0.02; x < 1; x += 0.05) { cx.fillStyle = `rgba(80,140,255,${0.8 * a})`; cx.fillRect(x * W, ty0 - PX, PX, PX); cx.fillRect(x * W, ty0 + th, PX, PX); }
    for (const x of [0.2, 0.5, 0.8]) {
      const pg = cx.createRadialGradient(x * W, 0.9 * H, 0, x * W, 0.9 * H, W * 0.16);
      pg.addColorStop(0, `rgba(255,214,150,${0.3 * a})`); pg.addColorStop(1, 'rgba(255,214,150,0)');
      cx.fillStyle = pg; cx.fillRect(x * W - W * 0.16, 0.74 * H, W * 0.32, H * 0.26);
    }
  }
  for (const x of [0.2, 0.5, 0.8]) {         // light masts
    cx.fillStyle = rgb(shade([90, 92, 92], k)); cx.fillRect(x * W - PX / 2, 0.708 * H, PX, 0.06 * H);
    cx.fillStyle = night > 0.25 ? 'rgba(255,230,180,.95)' : rgb(shade([150, 150, 146], k)); cx.fillRect(x * W - 2 * PX, 0.703 * H, 4 * PX, PX);
  }
}
