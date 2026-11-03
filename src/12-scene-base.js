// ---------- Window view: hangars, air defence sites, missile launches ----------
const PAT_SITES = [0.44, 0.56], SHO_SITES = [0.3, 0.68, 0.76], AD_Y = 0.645;
function buildingNow(key) { return S.build && S.build.key === key ? clamp((S.t - S.build.start) / (S.build.done - S.build.start), 0, 1) : -1; }

function drawHangars(k, night, now, base) {
  const h = 0.06 * H, prog = buildingNow('hangar');
  HANGAR_SITES.forEach((x, i) => {
    const X = x * W, w = HANGAR_W * W, top = base - h;
    if (i < S.base.hangar) {
      cx.fillStyle = rgb(shade([118, 124, 120], k)); cx.fillRect(X, top, w, h);
      cx.fillStyle = rgb(shade([138, 144, 140], k)); ell(X + w / 2, top, w / 2, h * 0.35);
      const occ = S.fleet.filter(a => { const s = slotInfo(a.slot); return s.hangar && s.h === i; });
      const open = occ.some(a => a.status !== 'ready' || a.task);
      cx.fillStyle = rgb(shade(open ? [30, 32, 34] : [82, 88, 86], k)); cx.fillRect(X + w * 0.1, base - h * 0.75, w * 0.8, h * 0.75);
      if (open && night > 0.3) { cx.fillStyle = `rgba(255,214,150,${0.25 + night * 0.3})`; cx.fillRect(X + w * 0.1, base - h * 0.75, w * 0.8, h * 0.75); }
      if (!open) { cx.fillStyle = rgb(shade([64, 70, 68], k)); for (let d = 1; d < 6; d++) cx.fillRect(X + w * (0.1 + d * 0.8 / 6), base - h * 0.75, PX, h * 0.75); }
      cx.fillStyle = `rgba(240,240,232,${0.35 + 0.4 * (1 - night)})`; cx.font = `${Math.round(Math.max(8, clamp(W * 0.01, 9, 13) / PX)) * PX}px "Silkscreen", monospace`; cx.textAlign = 'left';
      cx.fillText(`H${i + 1}`, X + 3, top + h * 0.2);
    } else if (i === S.base.hangar && prog >= 0) {
      cx.fillStyle = rgb(shade([150, 150, 144], k)); cx.fillRect(X, base - 2, w, 3);
      cx.strokeStyle = rgb(shade([186, 120, 64], k)); cx.lineWidth = PX; cx.beginPath();
      const cols = Math.ceil(prog * 8);
      for (let c = 0; c <= cols; c++) { cx.moveTo(X + w * c / 8, base); cx.lineTo(X + w * c / 8, top + h * 0.1); }
      if (prog > 0.4) { cx.moveTo(X, top); cx.ellipse(X + w / 2, top, w / 2, h * 0.35, 0, Math.PI, Math.PI + Math.PI * clamp((prog - 0.4) / 0.6, 0, 1)); }
      cx.stroke();
      const mx = X + w * 1.06, mtop = base - 0.17 * H, swing = Math.sin(now / 1500) * w * 0.15;
      cx.strokeStyle = rgb(shade([214, 168, 40], k)); cx.lineWidth = 1.5 * PX; cx.beginPath();
      cx.moveTo(mx, base); cx.lineTo(mx, mtop); cx.moveTo(mx + w * 0.15, mtop); cx.lineTo(mx - w * 0.9, mtop); cx.stroke();
      cx.lineWidth = PX; cx.beginPath(); cx.moveTo(mx - w * 0.5 + swing, mtop); cx.lineTo(mx - w * 0.5 + swing, top - h * 0.3); cx.stroke();
      if ((now % 1200) < 500) { cx.fillStyle = 'rgba(255,60,50,.9)'; ell(mx, mtop - 2, PX, PX); }
    } else {
      cx.fillStyle = rgb(shade([132, 134, 126], k), 0.55); cx.fillRect(X, base - 1.5, w, 2.5);
    }
  });
}

function drawBaseExtras(L, k, now) {
  const asph = rgb(shade([72, 74, 76], k));
  if (S.base.hangar > 0) {
    const y0 = (FT - 0.007) * H, th = 0.014 * H;
    cx.fillStyle = asph;
    cx.fillRect(0.04 * W, y0, 0.86 * W, th);
    for (let i = 0; i < S.base.hangar; i++) cx.fillRect((HANGAR_SITES[i] + HANGAR_W * 0.12) * W, G.bld * H, HANGAR_W * 0.76 * W, y0 - G.bld * H + 1);
    const ry0 = (G.rwy - G.rwyH / 2) * H;
    poly([[0.88 * W, y0], [0.9 * W, y0], [0.97 * W, ry0 + 1], [0.93 * W, ry0 + 1]]);
    poly([[0.12 * W, y0], [0.15 * W, y0], [0.19 * W, ry0 + 1], [0.14 * W, ry0 + 1]]);
    cx.fillStyle = `rgba(232,190,60,${0.35 + 0.4 * L})`; cx.fillRect(0.04 * W, FT * H - PX / 2, 0.86 * W, PX);
  }
  const s = UL() * gsc(AD_Y), y = AD_Y * H;
  const unit = (sx, kind, p) => {
    const X = sx * W;
    cx.globalAlpha = p < 0 ? 1 : 0.55;
    cx.fillStyle = 'rgba(0,0,0,.25)'; ell(X, y + 1, s * 0.5, s * 0.05);
    if (kind === 'pat') {
      cx.fillStyle = rgb(shade([96, 104, 84], k)); cx.fillRect(X - s * 0.45, y - s * 0.16, s * 0.9, s * 0.12);
      cx.fillStyle = rgb(shade([30, 30, 30], k)); for (const wx of [-0.32, -0.12, 0.25]) ell(X + wx * s, y - s * 0.03, s * 0.05, s * 0.05);
      if (p < 0) {
        cx.save(); cx.translate(X - s * 0.1, y - s * 0.17); cx.rotate(-0.62);
        cx.fillStyle = rgb(shade([110, 118, 96], k)); cx.fillRect(-s * 0.1, -s * 0.24, s * 0.62, s * 0.24);
        cx.fillStyle = rgb(shade([70, 76, 62], k)); for (let c = 0; c < 4; c++) cx.fillRect(s * 0.5, -s * 0.23 + c * s * 0.06, s * 0.02, s * 0.04);
        cx.restore();
      }
    } else {
      cx.fillStyle = rgb(shade([102, 108, 86], k)); cx.fillRect(X - s * 0.3, y - s * 0.16, s * 0.6, s * 0.13);
      cx.fillRect(X - s * 0.12, y - s * 0.24, s * 0.26, s * 0.09);
      cx.fillStyle = rgb(shade([30, 30, 30], k)); ell(X - s * 0.2, y - s * 0.03, s * 0.05, s * 0.05); ell(X + s * 0.2, y - s * 0.03, s * 0.05, s * 0.05);
      if (p < 0) { cx.fillStyle = rgb(shade([84, 90, 72], k)); cx.fillRect(X - s * 0.24, y - s * 0.32, s * 0.1, s * 0.12); cx.fillRect(X + s * 0.14, y - s * 0.32, s * 0.1, s * 0.12); }
    }
    if (p >= 0) { cx.fillStyle = 'rgba(240,120,30,.95)'; for (const cxo of [-0.6, 0.6]) poly([[X + cxo * s - 2, y], [X + cxo * s + 2, y], [X + cxo * s, y - 6]]); }
    cx.globalAlpha = 1;
  };
  const pb = buildingNow('patriot'), sb = buildingNow('shorad');
  PAT_SITES.forEach((x, i) => { if (i < S.base.patriot) unit(x, 'pat', -1); else if (i === S.base.patriot && pb >= 0) unit(x, 'pat', pb); });
  SHO_SITES.forEach((x, i) => { if (i < S.base.shorad) unit(x, 'sho', -1); else if (i === S.base.shorad && sb >= 0) unit(x, 'sho', sb); });
}

function drawSamFx(f, L) {
  const t = clamp((S.t - f.born) / f.life, 0, 1), sx = (f.site === 'pat' ? PAT_SITES : SHO_SITES)[f.i] ?? 0.5;
  const at = u => [(sx + f.dir * u * (f.site === 'pat' ? 0.28 : 0.18)) * W, (AD_Y - 0.02 - u * u * 0.62) * H];
  cx.lineWidth = 1.5 * PX; cx.lineCap = 'round';
  for (let j = 0; j < 14; j++) {
    const u0 = t * j / 14, u1 = t * (j + 1) / 14, [x0, y0] = at(u0), [x1, y1] = at(u1);
    const g = Math.round(lerp(150, 230, L));
    cx.strokeStyle = `rgba(${g},${g},${g},${(0.15 + 0.5 * (j / 14)) * (1 - t * 0.6)})`;
    cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke();
  }
  if (t < 0.98) { const [hx, hy] = at(t); cx.fillStyle = 'rgba(255,236,190,.95)'; ell(hx, hy, PX, PX); cx.fillStyle = 'rgba(255,150,60,.5)'; ell(hx, hy, 6, 6); }
  if (t < 0.12) { const [x0, y0] = at(0); cx.fillStyle = `rgba(255,190,110,${0.7 * (1 - t / 0.12)})`; ell(x0, y0, 10, 6); }
  cx.lineCap = 'butt';
}
