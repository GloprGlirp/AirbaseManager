// ---------- Window view: aircraft, vehicles, effects ----------
const SHAPES = {
  'F-16C': { body: [[.5,0],[.36,-.035],[.2,-.055],[.1,-.1],[0,-.1],[-.08,-.065],[-.28,-.06],[-.36,-.27],[-.45,-.27],[-.47,-.06],[-.5,-.03],[-.5,.02],[-.3,.04],[.08,.05],[.3,.035]],
    dark: [[[.14,.02],[-.2,.015],[-.27,.055],[-.02,.05]], [[-.3,.005],[-.5,-.005],[-.46,.05]], [[.2,.05],[.06,.095],[-.06,.05]]], canopy: [.1, -.072, .085, .03], col: [138, 146, 154] },
  'F-15E': { body: [[.5,0],[.38,-.03],[.26,-.05],[.18,-.095],[.06,-.1],[-.04,-.07],[-.3,-.07],[-.33,-.29],[-.42,-.3],[-.44,-.07],[-.5,-.045],[-.5,.03],[-.3,.055],[.1,.06],[.3,.035]],
    back: [[-.25,-.07],[-.27,-.25],[-.35,-.26],[-.36,-.07]],
    dark: [[[.16,.025],[-.22,.02],[-.29,.06],[-.02,.058]], [[-.3,.0],[-.52,-.01],[-.47,.05]]], canopy: [.13, -.07, .1, .032], col: [96, 102, 108] },
  'F/A-18E': { body: [[.5,0],[.38,-.03],[.24,-.045],[.16,-.09],[.05,-.095],[-.05,-.065],[-.26,-.06],[-.31,-.25],[-.4,-.26],[-.42,-.06],[-.5,-.035],[-.5,.025],[-.3,.045],[.1,.05],[.3,.03]],
    back: [[-.22,-.06],[-.25,-.22],[-.33,-.23],[-.34,-.06]],
    dark: [[[.14,.02],[-.2,.02],[-.26,.055],[-.04,.05]], [[-.32,0],[-.52,-.01],[-.47,.045]], [[.3,.02],[.06,.02],[0,.04],[.28,.035]]], canopy: [.14, -.066, .09, .03], col: [142, 150, 156] },
  'A-10C': { body: [[.5,.01],[.44,-.03],[.34,-.05],[.27,-.085],[.16,-.085],[.08,-.05],[-.36,-.045],[-.5,-.03],[-.5,.02],[-.2,.045],[.36,.04]],
    fin: [[-.38,-.04],[-.42,-.21],[-.5,-.21],[-.5,-.03]], back: [[-.34,-.04],[-.37,-.18],[-.44,-.18],[-.45,-.04]],
    dark: [[[.12,-.005],[-.08,-.005],[-.08,.03],[.12,.03]], [[-.3,-.02],[-.52,-.03],[-.5,0]]], pods: [[-.18, -.095, .1, .032]], canopy: [.21, -.073, .06, .024], col: [94, 102, 98], ab: false, legs: [.3, -.02] },
  'F-35A': { body: [[.5,0],[.36,-.04],[.22,-.07],[.12,-.1],[0,-.1],[-.1,-.07],[-.3,-.065],[-.34,-.22],[-.43,-.23],[-.45,-.065],[-.5,-.04],[-.5,.03],[-.3,.06],[.1,.065],[.32,.035]],
    back: [[-.28,-.065],[-.3,-.2],[-.38,-.21],[-.39,-.065]],
    dark: [[[.1,.03],[-.24,.025],[-.3,.06],[-.06,.062]], [[-.32,.01],[-.52,0],[-.48,.05]]], canopy: [.15, -.084, .08, .03], col: [106, 112, 116] },
  'E-3G': { body: [[.5,.005],[.47,-.04],[.4,-.058],[-.3,-.058],[-.42,-.045],[-.5,-.03],[-.5,0],[-.42,.025],[.4,.038],[.48,.025]],
    fin: [[-.3,-.055],[-.43,-.27],[-.49,-.27],[-.46,-.05]], dark: [[[.12,.01],[-.12,0],[-.2,.03],[.06,.032]]], col: [180, 184, 186], legs: [.38, -.02], ab: false, airliner: true, dome: true },
  'KC-135R': { body: [[.5,.005],[.47,-.04],[.4,-.058],[-.3,-.058],[-.42,-.045],[-.5,-.03],[-.5,0],[-.42,.025],[.4,.038],[.48,.025]],
    fin: [[-.3,-.055],[-.43,-.27],[-.49,-.27],[-.46,-.05]], dark: [[[.12,.01],[-.12,0],[-.2,.03],[.06,.032]]], col: [168, 172, 174], legs: [.38, -.02], ab: false, airliner: true, boom: true },
  'C-130H': { body: [[.5,.02],[.48,-.04],[.42,-.08],[.3,-.095],[-.2,-.095],[-.4,-.055],[-.5,-.045],[-.5,-.01],[-.3,.06],[.38,.07],[.47,.05]],
    fin: [[-.33,-.08],[-.42,-.36],[-.5,-.36],[-.47,-.04]], dark: [[[.2,-.095],[-.06,-.095],[-.06,-.118],[.2,-.118]]], col: [112, 118, 102], legs: [.4, .02, .12], ab: false },
};
const GEAR_H = { 'F-16C': .11, 'F-15E': .11, 'F/A-18E': .11, 'A-10C': .1, 'F-35A': .11, 'KC-135R': .085, 'E-3G': .085, 'C-130H': .1 };

function along(pts, t) {
  const seg = []; let L = 0;
  for (let i = 1; i < pts.length; i++) { const d = hyp((pts[i][0] - pts[i - 1][0]) * W, (pts[i][1] - pts[i - 1][1]) * H); seg.push(d); L += d; }
  let d = clamp(t, 0, 1) * L;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const u = seg[i] ? clamp(d / seg[i], 0, 1) : 0, a = pts[i], b = pts[i + 1];
      return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), dx: b[0] - a[0] };
    }
    d -= seg[i];
  }
  return { x: pts[0][0], y: pts[0][1], dx: 0 };
}
const easeIO = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const FT = 0.523;   // far-side taxiway in front of the hangars
const slotOf = o => o.type === 'C-130H' ? { x: CARGO_SPOT, hangar: false } : slotInfo(o.slot);
function holdX(o, far) {
  const q = [...S.fleet, ...S.cargo].filter(x => x.phase === 'hold' && !!slotOf(x).hangar === far).indexOf(o);
  return far ? 0.905 - 0.05 * Math.max(0, q) : 0.865 - 0.075 * Math.max(0, q);
}
function pose(o) {
  const si = slotOf(o), sx = si.x, far = !!si.hangar, ph = o.phase, b = { face: 1, pitch: 0 };
  const faceOf = p => p.dx < -0.0001 ? -1 : 1;
  const yS = far ? G.bld + 0.004 : G.apr, yT = far ? FT : G.twy;
  if (!ph || ph === 'unload' || (ph === 'taxi' && o.phT <= 0)) return far ? null : { ...b, x: sx, y: G.apr, parked: true };
  if (ph === 'taxi') { const t = clamp(o.phT / DEP.taxi, 0, 1), p = along([[sx, yS], [sx, yT], [holdX(o, far), yT]], easeIO(t)); return { ...b, x: p.x, y: p.y, face: faceOf(p), moving: true, alpha: far ? clamp(t * 8, 0, 1) : 1 }; }
  if (ph === 'hold') return { ...b, x: holdX(o, far), y: yT, moving: true };
  if (ph === 'roll') {
    const t = clamp(o.phT / DEP.roll, 0, 1);
    if (t < 0.2) { const p = along([[holdX(o, far), yT], [0.95, G.rwy]], t / 0.2); return { ...b, x: p.x, y: p.y, face: t < 0.12 ? 1 : -1, moving: true }; }
    const u = Math.pow((t - 0.2) / 0.8, 2);
    return { ...b, x: lerp(0.95, 0.4, u), y: G.rwy, face: -1, ab: true, pitch: u > 0.85 ? (u - 0.85) / 0.15 * 0.12 : 0, moving: true };
  }
  if (ph === 'climb') {
    const t = clamp(o.phT / DEP.climb, 0, 1);
    return { ...b, x: lerp(0.4, -0.15, t), y: lerp(G.rwy - 0.03, 0.06, Math.pow(t, 1.3)), face: -1, ab: t < 0.6, pitch: 0.17, lift: true, gear: t < 0.25, scale: lerp(0.5, 0.2, t), alpha: t > 0.85 ? (1 - t) / 0.15 : 1, moving: true };
  }
  if (ph === 'final') {
    const t = clamp(o.phT / ARR.final, 0, 1);
    return { ...b, x: lerp(1.15, 0.84, t), y: lerp(0.12, G.rwy - 0.03, 1 - Math.pow(1 - t, 1.3)), face: -1, pitch: 0.05, lift: true, gear: t > 0.3, scale: lerp(0.22, 0.5, t), landing: true, moving: true };
  }
  if (ph === 'rollout') { const t = clamp(o.phT / ARR.rollout, 0, 1); return { ...b, x: lerp(0.84, 0.16, 1 - Math.pow(1 - t, 2)), y: G.rwy, face: -1, moving: true }; }
  if (ph === 'taxiin') { const t = clamp(o.phT / ARR.taxiin, 0, 1), p = along([[0.16, G.rwy], [far ? 0.13 : 0.11, yT], [sx, yT], [sx, yS]], easeIO(t)); return { ...b, x: p.x, y: p.y, face: faceOf(p), moving: true, alpha: far ? clamp((1 - t) * 8, 0, 1) : 1 }; }
  return null;
}

function drawPlane(o, p, L, now) {
  const sh = SHAPES[o.type], T = TYPES[o.type], k = 0.24 + 0.76 * L, night = 1 - L;
  const len = UL() * (T.size || 1) * (p.scale ?? gsc(p.y)), X = p.x * W, Y = p.y * H, gh = GEAR_H[o.type];
  cx.globalAlpha = p.alpha ?? 1;
  if (p.lift) {
    const gy = G.rwy * H, d = clamp(1 - (gy - Y) / (H * 0.45), 0, 1);
    if (d > 0) { cx.fillStyle = `rgba(0,0,0,${0.22 * d * (0.3 + 0.7 * L)})`; ell(X + len * 0.1, gy + 2, len * 0.45 * d, len * 0.035 * d); }
  } else { cx.fillStyle = `rgba(0,0,0,${0.15 + 0.2 * L})`; ell(X, Y, len * 0.5, len * 0.045); }
  if (p.landing && night > 0.3) {
    const lg = cx.createRadialGradient(X - len * 0.6, Y + len * 0.05, 0, X - len * 0.6, Y + len * 0.05, len * 1.4);
    lg.addColorStop(0, `rgba(255,250,225,${0.45 * night})`); lg.addColorStop(1, 'rgba(255,250,225,0)');
    cx.fillStyle = lg; cx.fillRect(X - len * 2, Y - len, len * 2.8, len * 2);
  }
  cx.save();
  cx.translate(X, p.lift ? Y : Y - len * gh);
  cx.scale(p.face, 1); cx.rotate(-(p.pitch || 0)); cx.scale(len, len);
  const col = shade(sh.col, k), dark = shade(sh.col, k * 0.68);
  if (p.gear !== false) {
    cx.strokeStyle = rgb(shade([40, 42, 44], k)); cx.lineWidth = 0.014; cx.fillStyle = rgb(shade([26, 27, 28], k));
    const legs = sh.legs || [0.28, -0.1];
    for (const lx of legs) { cx.beginPath(); cx.moveTo(lx, 0.02); cx.lineTo(lx, gh - 0.02); cx.stroke(); ell(lx, gh - 0.02, 0.022, 0.022); }
  }
  if (p.ab && sh.ab !== false) {
    const fl = 0.28 + Math.random() * 0.1, g = cx.createLinearGradient(-0.5, 0, -0.5 - fl, 0);
    g.addColorStop(0, 'rgba(255,245,220,.95)'); g.addColorStop(0.25, 'rgba(255,170,70,.85)'); g.addColorStop(1, 'rgba(255,90,30,0)');
    cx.fillStyle = g; poly([[-0.49, -0.035], [-0.5 - fl, -0.008], [-0.49, 0.02]]);
  }
  if (sh.back) { cx.fillStyle = rgb(dark); poly(sh.back); }
  cx.fillStyle = rgb(col); poly(sh.body);
  if (sh.fin) poly(sh.fin);
  cx.fillStyle = rgb(dark); for (const d of sh.dark) poly(d);
  if (sh.airliner) {
    ell(0.1, 0.055, 0.07, 0.02); ell(-0.04, 0.05, 0.06, 0.018);
    if (sh.boom) { cx.strokeStyle = rgb(dark); cx.lineWidth = 0.012; cx.beginPath(); cx.moveTo(-0.45, 0.02); cx.lineTo(-0.6, 0.09); cx.stroke(); }
    if (sh.dome) {
      cx.strokeStyle = rgb(dark); cx.lineWidth = 0.012; cx.beginPath(); cx.moveTo(-0.08, -0.055); cx.lineTo(-0.1, -0.13); cx.moveTo(-0.16, -0.055); cx.lineTo(-0.15, -0.13); cx.stroke();
      cx.fillStyle = rgb(shade([58, 62, 68], k)); ell(-0.125, -0.145, 0.15, 0.026);
      cx.fillStyle = rgb(shade([222, 222, 216], k)); cx.fillRect(-0.27, -0.15, 0.29, 0.008);
    }
    cx.fillStyle = night > 0.4 ? 'rgba(255,220,160,.8)' : rgb(shade([40, 50, 58], k));
    for (let x = 0.33; x > -0.26; x -= 0.045) cx.fillRect(x, -0.03, 0.014, 0.012);
    cx.fillStyle = rgb(shade([30, 40, 48], k)); poly([[0.47, -0.03], [0.43, -0.045], [0.42, -0.028]]);
  } else if (o.type === 'C-130H') {
    ell(0.14, -0.1, 0.07, 0.022); ell(0, -0.1, 0.07, 0.022); ell(0.05, 0.066, 0.13, 0.024);
    cx.fillStyle = `rgba(30,32,34,${0.35})`; ell(0.215, -0.1, 0.006, 0.08); ell(0.075, -0.1, 0.006, 0.08);
    cx.fillStyle = rgb(shade([30, 40, 48], k)); poly([[0.46, -0.03], [0.41, -0.07], [0.4, -0.035]]);
  } else {
    if (sh.pods) { cx.fillStyle = rgb(dark); for (const q of sh.pods) ell(...q); }
    const [cxp, cyp, rx, ry] = sh.canopy, cg = cx.createLinearGradient(cxp, cyp - ry, cxp, cyp + ry);
    cg.addColorStop(0, rgb(shade([150, 175, 185], k))); cg.addColorStop(1, rgb(shade([40, 52, 60], k)));
    cx.fillStyle = cg; ell(cxp, cyp, rx, ry);
  }
  if (p.moving || p.lift) {
    if ((now % 1100) < 90) { cx.fillStyle = 'rgba(255,60,50,.95)'; ell(-0.05, -0.1, 0.018, 0.018); }
    if (night > 0.3) { cx.fillStyle = 'rgba(255,255,255,.9)'; ell(-0.46, -0.05, 0.012, 0.012); }
  }
  cx.restore();
  cx.globalAlpha = 1;
}

function drawService(o, p, L, now) {
  const kind = o.phase === 'unload' ? 'unload' : (o.task && p.parked ? o.task.kind : null);
  if (!kind) return;
  const k = 0.24 + 0.76 * L, len = UL() * (TYPES[o.type].size || 1), X = p.x * W, Y = p.y * H, u = UL() * 0.55;
  const box = (x, y, w, h, c) => { cx.fillStyle = rgb(shade(c, k)); cx.fillRect(x, y - h, w, h); };
  const wheel = (x, y) => { cx.fillStyle = rgb(shade([22, 22, 22], k)); ell(x, y, u * 0.07, u * 0.07); };
  const person = (x, y) => { box(x - PX / 2, y, PX, u * 0.28, [40, 46, 52]); cx.fillStyle = `rgba(230,220,90,${0.5 + 0.4 * L})`; cx.fillRect(x - PX / 2, y - u * 0.22, PX, u * 0.08); };
  if (kind === 'refuel') {
    const tx = X + len * 0.55, ty = Y - 2;
    box(tx, ty - u * 0.07, u * 0.75, u * 0.3, [200, 200, 188]); box(tx + u * 0.75, ty - u * 0.07, u * 0.25, u * 0.36, [150, 40, 34]);
    wheel(tx + u * 0.12, ty); wheel(tx + u * 0.6, ty); wheel(tx + u * 0.88, ty);
    cx.strokeStyle = rgb(shade([20, 20, 20], k)); cx.lineWidth = PX; cx.beginPath(); cx.moveTo(tx + 2, ty - u * 0.15); cx.quadraticCurveTo(tx - len * 0.15, ty + 4, X + len * 0.05, Y - len * 0.1); cx.stroke();
    person(tx - u * 0.1, Y + 2);
  } else if (kind === 'arm') {
    const tx = X + len * 0.15, ty = Y + u * 0.35;
    box(tx, ty - u * 0.06, u * 0.9, u * 0.08, [70, 82, 60]);
    for (let i = 0; i < 3; i++) { cx.fillStyle = rgb(shade([215, 215, 205], k)); cx.fillRect(tx + u * 0.05, ty - u * (0.15 + i * 0.07), u * 0.8, u * 0.05); }
    wheel(tx + u * 0.1, ty); wheel(tx + u * 0.8, ty);
    person(X - len * 0.05, Y + 3); person(X + len * 0.12, Y + 2);
  } else if (kind === 'repair') {
    box(X - len * 0.32, Y, u * 0.12, len * 0.16, [190, 160, 60]);
    box(X - len * 0.38, Y, u * 0.35, u * 0.06, [190, 160, 60]);
    if ((now % 900) < 450) { cx.fillStyle = 'rgba(255,170,40,.95)'; ell(X - len * 0.27, Y - len * 0.17, 2.2, 2.2); }
    person(X - len * 0.42, Y + 2); person(X + len * 0.3, Y + 3);
  } else if (kind === 'unload') {
    const sw = (Math.sin(now / 1200) + 1) / 2, fx = X - len * 0.62 - sw * len * 0.35, fy = Y + 3;
    box(fx, fy - u * 0.06, u * 0.5, u * 0.28, [222, 176, 40]); box(fx - u * 0.12, fy - u * 0.06, u * 0.05, u * 0.5, [60, 60, 60]);
    box(fx - u * 0.42, fy - u * 0.12, u * 0.32, u * 0.22, [110, 92, 64]);
    wheel(fx + u * 0.1, fy); wheel(fx + u * 0.4, fy);
    person(X - len * 0.5, Y + 2);
  }
}

function drawSmoke(f, L, now) {
  const age = (S.t - f.born) / f.life, fade = Math.min(1, (1 - age) * 3), bx = f.x * W, by = (f.at === 'farm' ? G.bld : G.rwy) * H;
  if ((1 - L) > 0.2 && age < 0.6) { cx.fillStyle = `rgba(255,${120 + Math.random() * 60},40,${0.55 * fade})`; ell(bx, by, W * 0.012, H * 0.012); }
  for (let i = 0; i < 10; i++) {
    const ph = ((now / 1000) * 0.18 + i / 10) % 1, r = (0.008 + ph * 0.03) * W * (0.6 + fade * 0.4);
    const g = Math.round(lerp(60, 120, ph) * (0.35 + 0.65 * L));
    cx.fillStyle = `rgba(${g},${g},${g + 4},${(1 - ph) * 0.55 * fade})`;
    ell(bx + Math.sin(i * 1.7 + ph * 3) * W * 0.01 + ph * W * 0.05 * (S.wx.kt / 10), by - ph * H * 0.32, r, r * 0.8);
  }
}
function drawRaid(f, L, now) {
  const t = (S.t - f.born) / 1.4;
  for (let i = 0; i < 3; i++) {
    const x = lerp(-0.1, 1.2, t - i * 0.07), y = 0.14 + i * 0.035;
    if (x < -0.1 || x > 1.2) continue;
    cx.save(); cx.translate(x * W, y * H); cx.scale(UL() * 0.45, UL() * 0.45);
    cx.fillStyle = `rgba(28,30,34,.95)`; poly(SHAPES['F-16C'].body); cx.restore();
  }
  if (t > 0.35 && t < 1.2) {
    const a = 1 - Math.abs(t - 0.6) * 1.6, fx = 0.5 * W, fy = G.rwy * H;
    const g = cx.createRadialGradient(fx, fy, 0, fx, fy, W * 0.35);
    g.addColorStop(0, `rgba(255,236,200,${clamp(a, 0, 1)})`); g.addColorStop(0.2, `rgba(255,140,50,${clamp(a * 0.6, 0, 1)})`); g.addColorStop(1, 'rgba(255,100,30,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  }
}
let FLASH = 0;
function drawWeather(L, now, dtR) {
  const kind = S.wx.kind;
  if (kind === 'fog') {
    const g = cx.createLinearGradient(0, 0, 0, H); const c = Math.round(lerp(40, 205, L));
    g.addColorStop(0, `rgba(${c},${c},${c + 5},.25)`); g.addColorStop(0.45, `rgba(${c},${c},${c + 5},.6)`); g.addColorStop(1, `rgba(${c},${c},${c + 5},.2)`);
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  }
  if (kind === 'rain' || kind === 'storm') {
    const n = kind === 'storm' ? 160 : 90, slant = S.wx.kt * 0.4;
    cx.strokeStyle = `rgba(190,202,218,${0.18 + 0.12 * L})`; cx.lineWidth = PX; cx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (((i * 0.7311) % 1) * W + now * 0.02 * slant) % (W + 20) - 10, y = (((i * 0.618) + now * 0.0011 * (1 + (i % 3) * 0.25)) % 1) * H;
      cx.moveTo(x, y); cx.lineTo(x - slant * 0.6, y + 11);
    }
    cx.stroke();
    cx.fillStyle = `rgba(210,220,235,${0.12 + 0.08 * L})`;
    for (let i = 0; i < 40; i++) ell(((i * 0.377) % 1) * W, ((i * 0.5813) % 1) * H, PX * 0.6, PX * 0.8);
    if (kind === 'storm' && S.speed && Math.random() < dtR * 0.25) { FLASH = 1; sfxThunder(); }
  }
  if (FLASH > 0) { cx.fillStyle = `rgba(230,236,255,${FLASH * 0.45})`; cx.fillRect(0, 0, W, H); FLASH = Math.max(0, FLASH - dtR * 3); }
  const night = 1 - L;
  if (night > 0.3) {                  // the terminal's glow reflected in the glass
    const g = cx.createLinearGradient(0, H * 0.7, 0, H);
    g.addColorStop(0, 'rgba(240,180,76,0)'); g.addColorStop(1, `rgba(240,180,76,${0.07 * night})`);
    cx.fillStyle = g; cx.fillRect(0, H * 0.7, W, H * 0.3);
  }
}
function drawScene(now, dtR) {
  if (!S || W < 10) return;
  const L = daylight(), ov = overcast(), gold = L > 0 && L < 1 ? 1 - Math.abs(L - 0.5) * 2 : 0, Le = L * (1 - ov * 0.35);
  drawSky(L, gold, ov, dtR);
  drawFarSide(Le, ov, now);
  for (const f of S.fx) if (f.kind === 'smoke' && f.at === 'farm') drawSmoke(f, Le, now);
  drawAirfield(Le, now);
  const actors = [];
  for (const a of S.fleet) {
    if (a.status === 'lost' || a.status === 'air' || a.status === 'ordered' || a.phase === 'inbound') continue;
    const p = pose(a); if (p) actors.push([a, p]);
  }
  for (const c of S.cargo) { if (c.phase === 'inbound') continue; const p = pose(c); if (p) actors.push([c, p]); }
  actors.sort((A, B) => A[1].y - B[1].y);
  for (const [o, p] of actors) { drawPlane(o, p, Le, now); drawService(o, p, Le, now); }
  for (const f of S.fx) { if (f.kind === 'smoke' && f.at === 'rwy') drawSmoke(f, Le, now); if (f.kind === 'raid') drawRaid(f, Le, now); if (f.kind === 'sam') drawSamFx(f, Le); }
  drawWeather(Le, now, dtR);
  quantize();
}
