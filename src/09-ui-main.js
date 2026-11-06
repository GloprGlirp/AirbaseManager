// ---------- Terminal chrome, tactical map, input, main loop ----------
const TABS = [['missions', 'Tasking'], ['flightline', 'Flightline'], ['supply', 'Supply'], ['base', 'Base'], ['tac', 'Tac map'], ['log', 'Comms']];
let lastTop = '', lastTabs = '', lastOverlay = '', lastTicker = '';
function updateTop() {
  $('#clock').textContent = fmtT(S.t);
  $('#funds').textContent = money(S.funds);
  const rep = $('#rep'); rep.textContent = Math.round(S.rep); rep.className = S.rep < 25 ? 'crit' : S.rep < 45 ? 'warn' : '';
  const tl = threatLevel(), al = $('#alert'); al.textContent = tl; al.className = tl === 'RED' ? 'crit' : tl === 'AMBER' ? 'warn' : 'ok';
  const sp = SPEED_LBL.map((l, i) => `<button class="btn${S.speed === i ? ' on' : ''}" data-act="speed" data-v="${i}" aria-pressed="${S.speed === i}">${l}</button>`).join('') + `<button class="btn" data-act="tutorial" style="margin-left:8px" title="Restart the tutorial">Help</button>` + `<button class="btn${SND.on ? ' on' : ''}" data-act="sound" aria-pressed="${SND.on}" style="margin-left:8px">Sound</button>`;
  if (sp !== lastTop) { $('#speed').innerHTML = sp; lastTop = sp; }
  $('#wx').textContent = `${WX_NAME[S.wx.kind]} · wind ${pad2(S.wx.wind / 10)}0/${pad2(S.wx.kt)} kt`;
  const closed = S.t < S.runway.closedUntil; const rs = $('#rwystate');
  rs.textContent = closed ? 'Runway closed' : S.runway.busy ? 'Runway occupied' : 'Runway open';
  rs.style.color = closed ? '#f08a64' : '';
  $('#pausedTag').hidden = !(S.started && !S.over && !S.debrief && S.speed === 0);
  const camp = isCampaign();
  $('#rankstat').hidden = !camp; $('#shiftstat').hidden = !(camp && S.shift);
  if (camp) {
    $('#rankname').textContent = CAREER[rankIdx()].short; $('#xpline').textContent = `Rank · ${S.xp} XP`;
    if (S.shift) { $('#shiftleft').textContent = S.debrief ? 'Shift over' : fmtDur(S.shift.end - S.t); $('#shiftname').textContent = `${S.shift.name} ${S.shift.n} left`; }
  }
}
function renderTabs() {
  const open = S.missions.filter(m => m.status === 'open'), urgent = open.some(m => m.type === 'INTERCEPT');
  const badge = { missions: open.length ? `<i class="${urgent ? '' : 'n'}">${open.length}</i>` : '', tac: S.flights.length ? `<i class="n">${S.flights.length}</i>` : '' };
  if (UI.tab === 'career' && !isCampaign()) UI.tab = 'missions';
  const tabs = isCampaign() ? [TABS[0], ['career', 'Career'], ...TABS.slice(1)] : TABS;
  const html = tabs.map(([k, l]) => `<button class="tab${UI.tab === k ? ' on' : ''}" data-act="tab" data-tab="${k}" aria-current="${UI.tab === k}">${l}${badge[k] || ''}</button>`).join('');
  if (html !== lastTabs) { $('#tabs').innerHTML = html; lastTabs = html; }
}
function overlayHTML() {
  if (S.over) return `<div class="brief" role="dialog" aria-labelledby="ovt"><p class="h">Message from wing command</p><h1 id="ovt">Relieved of command</h1>
    <p>Your command rating reached zero on ${fmtT(S.t)}. A new duty officer is taking over Kestrel Field.</p>
    <ul>${isCampaign() ? `<li>Final rank <b>${CAREER[rankIdx()].name}</b> with ${S.xp} XP after <b>${S.shiftsDone}</b> shifts</li>` : ''}<li><b>${S.stats.won}</b> operations completed, <b>${S.stats.failed}</b> failed</li><li><b>${S.stats.kills}</b> enemy aircraft destroyed</li><li><b>${S.stats.lost}</b> jets lost, <b>${S.stats.sorties}</b> sorties flown</li></ul>
    <div class="acts"><button class="btn go big" data-act="new">Start again</button></div></div>`;
  if (S.started) return S.debrief ? debriefHTML() : '';
  const intro = `<p class="h">Shift briefing · Kestrel Field</p><h1 id="ovt">You have the ops desk</h1>
    <p>Out the window is runway 27 and the ramp. On the terminal is everything that keeps it working. Order fuel and munitions, turn jets around, and send flights on tasking.</p>
    <ul><li><b>Tasking</b> pays the budget. Ignored or failed operations cost command rating.</li>
      <li><b>Flightline</b>: refuel, arm and repair. <b>Supply</b> comes in by C-130.</li>
      <li><b>Base</b>: build hangars and air defences, train crews, buy aircraft.</li>
      <li><b>Tac map</b>: follow flights, change tactics in the air, send them to the tanker or home.</li>
      <li>Raids that reach the base burn fuel and crater the runway. Intercept them.</li></ul>
    <p class="muted">Space pauses, keys 1 to 4 set speed. Progress is saved in this browser.</p>`;
  if (UI.resume) return `<div class="brief" role="dialog" aria-labelledby="ovt">${intro}<div class="acts"><button class="btn go big" data-act="resume">Resume ${isCampaign() ? 'campaign' : 'free play'} · ${fmtT(S.t)}</button><button class="btn" data-act="new">New game</button></div></div>`;
  return `<div class="brief" role="dialog" aria-labelledby="ovt">${intro}<div class="modes">
    <button class="mode go" data-act="tutorial-start"><b>Tutorial</b><span>Recommended for your first shift. A step-by-step guide through the desk, then the campaign carries on.</span></button>
    <button class="mode" data-act="campaign"><b>Campaign</b><span>Work 8-hour shifts with three objectives each. Earn XP, get promoted and unlock new aircraft, base upgrades and training.</span></button>
    <button class="mode" data-act="free"><b>Free play</b><span>No shifts and no ranks. Every aircraft and upgrade is available from the start.</span></button></div></div>`;
}
// Urgent strip under the tabs: closed runway and inbound raids, each with a one-click fix
function alertsHTML() {
  if (!S.started || S.over || S.debrief) return '';
  const out = [];
  if (S.t < S.runway.closedUntil) {
    const c = rushCost(), blk = rushBlock();
    out.push(`<div class="al"><b>Runway 27 closed</b><span>Crater repair, open again in ${fmtDur(S.runway.closedUntil - S.t)}. Jets can still taxi and wait at the runway.</span>${c ? `<button class="btn red" data-act="rush" ${blk ? 'disabled' : ''}>Emergency repair · ${money(c)}</button>${blk === 'Not enough budget' ? '<em>Not enough budget</em>' : ''}` : '<em>Engineers finishing up</em>'}</div>`);
  }
  for (const r of S.raids) {
    const m = MS(r.mission), f = m && FL(m.flight), eta = fmtDur((hyp(r.x, r.y) - 14) / r.speed);
    out.push(`<div class="al"><b>Raid inbound</b><span>${r.n} enemy fighter${r.n > 1 ? 's' : ''} from the ${bearingName(r.x, r.y)}, over the base in ${eta}.${f ? ` ${f.call}: ${FSTATE[f.state].toLowerCase()}.` : ''}</span>${m && !f && m.status === 'open' ? `<button class="btn go" data-act="planint" data-id="${m.id}">Plan intercept</button>` : ''}</div>`);
  }
  return out.join('');
}
function renderUI(force) {
  if (!S) return;
  tutTick();
  updateTop(); renderTabs();
  const al = alertsHTML(), alb = $('#alerts');
  if (al !== UI.lastAlerts) { alb.innerHTML = al; alb.hidden = !al; UI.lastAlerts = al; }
  const cl = clipHTML();
  if (cl !== UI.lastClip) { $('#clip').innerHTML = cl; UI.lastClip = cl; }
  const ch = coachHTML(), co = $('#coach');
  if (ch !== UI.lastCoach) { co.innerHTML = ch; co.hidden = !ch; UI.lastCoach = ch; }
  const ov = overlayHTML();
  if (ov !== lastOverlay) { const o = $('#overlay'); o.innerHTML = ov; o.hidden = !ov; lastOverlay = ov; }
  const last = S.log[S.log.length - 1];
  const tk = last ? `<time>${fmtClock(last.t)}</time><span class="${last.cls === 'crit' ? 'critc' : last.cls === 'good' ? 'okc' : last.cls === 'warn' ? 'warnc' : ''}">${esc(last.msg)}</span>` : '';
  if (tk !== lastTicker) { $('#ticker').innerHTML = tk; lastTicker = tk; }
  if (UI.down && !force) return;
  const panel = $('#panel'), changed = UI.lastTab !== UI.tab;
  if (changed) { UI.lastHTML = ''; UI.lastSide = ''; }
  if (UI.tab === 'tac') {
    if (changed || !$('#tacmap')) panel.innerHTML = '<div class="tac"><div class="scope"><canvas id="tacmap" aria-label="Tactical map, 300 km around Kestrel Field"></canvas></div><div class="side" id="tacside"></div></div>';
    const html = tacSideHTML();
    if (html !== UI.lastSide) { $('#tacside').innerHTML = html; UI.lastSide = html; }
  } else {
    const html = { supply: supplyHTML, flightline: flightlineHTML, missions: missionsHTML, base: baseHTML, career: careerHTML, log: logHTML }[UI.tab]();
    if (html !== UI.lastHTML) { panel.innerHTML = html; UI.lastHTML = html; }
  }
  if (changed) { panel.scrollTop = 0; UI.lastTab = UI.tab; }
  applyCoach();
}

// ---------- Tactical map ----------
const COAST = Array.from({ length: 33 }, (_, i) => { const y = -320 + i * 20; return [130 + Math.sin(y / 60) * 34 + Math.sin(y / 23) * 12, y]; });
let TAC = { ox: 0, oy: 0, s: 1 };
function drawTac(now) {
  const c = $('#tacmap'); if (!c) return;
  const r = c.getBoundingClientRect(); if (r.width < 20) return;
  const dpr = 0.5;   // printed-map look: half resolution, scaled up pixelated
  if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = r.width, h = r.height, ox = w / 2, oy = h / 2, s = (Math.min(w, h) / 2 - 16) / 300;
  TAC = { ox, oy, s };
  const P = (x, y) => [ox + x * s, oy + y * s];
  g.fillStyle = '#d3c7a2'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(45,60,71,.2)'; g.beginPath(); COAST.forEach(([x, y], i) => { const p = P(x, y); i ? g.lineTo(...p) : g.moveTo(...p); }); g.lineTo(w + 10, h + 10); g.lineTo(w + 10, -10); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(46,38,32,.75)'; g.lineWidth = 2; g.beginPath(); COAST.forEach(([x, y], i) => { const p = P(x, y); i ? g.lineTo(...p) : g.moveTo(...p); }); g.stroke();
  g.strokeStyle = 'rgba(46,38,32,.12)'; g.beginPath();
  for (let v = -300; v <= 300; v += 50) { g.moveTo(...P(v, -400)); g.lineTo(...P(v, 400)); g.moveTo(...P(-400, v)); g.lineTo(...P(400, v)); }
  g.stroke();
  g.font = '16px "Silkscreen", monospace'; g.textAlign = 'left';
  for (const rr of [100, 200, 300]) { g.strokeStyle = 'rgba(46,38,32,.45)'; g.beginPath(); g.arc(ox, oy, rr * s, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(46,38,32,.8)'; g.fillText(`${rr} km`, ox + 4, oy - rr * s + 12); }
  for (const [lbl, x, y] of [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]]) { g.fillStyle = '#2e2620'; g.textAlign = 'center'; g.fillText(lbl, ox + x * (300 * s + 9), oy + y * (300 * s + 9) + 4); }
  const sw = (now / 3000) % 1 * Math.PI * 2;
  for (let i = 0; i < 24; i++) { const a = sw - i * 0.02; g.strokeStyle = `rgba(122,46,31,${0.07 * (1 - i / 24)})`; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(a) * 300 * s, oy + Math.sin(a) * 300 * s); g.stroke(); }
  g.textAlign = 'left';
  for (const m of S.missions) {
    if (!(m.status === 'open' || m.status === 'active') || m.type === 'INTERCEPT') continue;
    const [x, y] = P(m.x, m.y), sel = m.id === UI.selM;
    if (m.sam) { g.strokeStyle = 'rgba(163,42,29,.5)'; g.setLineDash([3, 3]); g.beginPath(); g.arc(x, y, (8 + m.sam * 6) * s, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
    g.fillStyle = m.status === 'active' ? '#7a2e1f' : 'rgba(122,46,31,.6)'; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y); g.lineTo(x, y + 6); g.lineTo(x - 6, y); g.closePath(); g.fill();
    if (sel) { g.strokeStyle = '#7a2e1f'; g.strokeRect(x - 9, y - 9, 18, 18); }
    g.fillStyle = '#7a2e1f'; g.fillText(`${m.op} ${m.type}`, x + 9, y + 3);
  }
  for (const rd of S.raids) {
    const [x, y] = P(rd.x, rd.y), a = Math.atan2(-rd.y, -rd.x);
    g.strokeStyle = 'rgba(163,42,29,.55)'; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(x, y); g.lineTo(ox, oy); g.stroke(); g.setLineDash([]);
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#a32a1d'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -6); g.lineTo(-2, 0); g.lineTo(-6, 6); g.closePath(); g.fill(); g.restore();
    const m = MS(rd.mission); g.fillStyle = '#a32a1d'; g.fillText(`${rd.n}× BANDIT${m ? ' · ' + m.op : ''}`, x + 10, y - 6);
  }
  for (const f of S.flights) {
    if (f.state === 'launch') continue;
    const [x, y] = P(f.x, f.y), sel = f.id === UI.selF;
    g.fillStyle = 'rgba(36,80,110,.55)'; for (const [tx, ty] of f.trail) { const p = P(tx, ty); g.fillRect(p[0] - 1, p[1] - 1, 2, 2); }
    const tg = flightTarget(f);
    if (tg) { g.strokeStyle = 'rgba(36,80,110,.5)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x, y); g.lineTo(...P(tg.x, tg.y)); g.stroke(); g.setLineDash([]); }
    if (f.enemy) { g.fillStyle = '#a32a1d'; for (let i = 0; i < f.enemy.n; i++) g.fillRect(x + 12 + i * 6, y + 8, 4, 4); }
    g.save(); g.translate(x, y); g.rotate(f.hdg);
    g.fillStyle = isSupport(f) ? '#4f7f96' : '#24506e'; g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -6); g.lineTo(-3, 0); g.lineTo(-6, 6); g.closePath(); g.fill(); g.restore();
    if (sel) { g.strokeStyle = '#24506e'; g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#24506e'; g.fillText(`${f.call} · ${f.state === 'engaged' ? 'ENGAGED' : FSTATE[f.state]}`, x + 12, y - 6);
  }
  g.fillStyle = '#2e2620'; g.fillRect(ox - 4, oy - 4, 8, 8); g.textAlign = 'right'; g.fillText('KESTREL', ox - 8, oy + 14); g.textAlign = 'left';
}
function tacClick(e) {
  const c = e.target.getBoundingClientRect(), mx = e.clientX - c.left, my = e.clientY - c.top;
  const near = (x, y) => hyp(TAC.ox + x * TAC.s - mx, TAC.oy + y * TAC.s - my);
  let best = null, bd = 18;
  for (const f of S.flights) if (f.state !== 'launch') { const d = near(f.x, f.y); if (d < bd) { bd = d; best = ['f', f.id]; } }
  for (const m of S.missions) if (m.status === 'open' || m.status === 'active') { const p = mPos(m), d = near(p.x, p.y); if (d < bd) { bd = d; best = ['m', m.id]; } }
  if (!best) return;
  if (best[0] === 'f') UI.selF = best[1]; else { UI.selM = best[1]; UI.tab = 'missions'; }
  renderUI(true);
}

// ---------- Input ----------
function beginGame(mode) {
  clearSave(); S = newGame(mode); S.started = true;
  UI.resume = false; UI.selM = null; UI.selF = null; UI.pick.clear(); UI.tab = 'missions';
  genMission('CAP');
  log('Shift start. Viper 1-3 needs fuel and weapons, Viper 1-4 needs repairs.');
  if (mode === 'campaign') beginShift();
}
function doAct(d) {
  const a = d.id ? AC(d.id) : null, f = d.f ? FL(d.f) : null;
  switch (d.act) {
    case 'tab': UI.tab = d.tab; break;
    case 'speed': S.speed = +d.v; break;
    case 'order': order(d.k); break;
    case 'turn': turnaround(a); break;
    case 'refuel': queueTask(a, 'refuel'); break;
    case 'repair': queueTask(a, 'repair'); break;
    case 'arm': queueTask(a, 'arm', d.v); break;
    case 'tanker': launch(null, [a.id], { ...DEFAULT_TAC }); break;
    case 'replace': requestReplacement(a); break;
    case 'build': startBuild(d.k); break;
    case 'train': startTraining(d.k); break;
    case 'buy': buyAircraft(d.k); break;
    case 'swap': swapPilot(a); break;
    case 'perk': unlockPerk(d.k); break;
    case 'rush': rushRunway(); break;
    case 'planint': UI.tab = 'missions'; UI.selM = d.id; UI.pick.clear(); break;
    case 'perkset': setPerk(d.k, d.v === 'on'); break;
    case 'sound': setSound(!SND.on); break;
    case 'selm': UI.selM = d.id; UI.pick.clear(); break;
    case 'pick': if (UI.pick.has(d.id)) UI.pick.delete(d.id); else if (UI.pick.size < 4) UI.pick.add(d.id); break;
    case 'tac': UI.tac[d.k] = d.v; break;
    case 'launch': {
      const before = S.flights.length;
      if (launch(UI.selM, [...UI.pick], UI.tac)) { UI.pick.clear(); UI.selF = S.flights[before].id; }
      break;
    }
    case 'self': UI.selF = d.id; break;
    case 'ftac': if (f) { f.tac[d.k] = d.v; radio(`${f.call}: copy, ${TAC_OPTS[d.k].label.toLowerCase()} ${TAC_OPTS[d.k].opts.find(o => o[0] === d.v)[1].toLowerCase()}.`); } break;
    case 'rtb': if (f) goRTB(f, 'ordered home'); break;
    case 'tank': if (f) orderTanker(f); break;
    case 'maps': UI.tab = 'tac'; UI.selF = d.f; break;
    case 'campaign': case 'free': beginGame(d.act); break;
    case 'nextshift': beginShift(); break;
    case 'tutorial-start': beginGame('campaign'); tutStart(); break;
    case 'tutorial': if (S.started && !S.over) tutStart(); break;
    case 'tutnext': tutAdvance(); break;
    case 'tutskip': tutEnd(); break;
    case 'resume': S.started = true; UI.resume = false; break;
    case 'new': clearSave(); S = newGame(); UI.resume = false; UI.selM = null; UI.selF = null; UI.pick.clear(); UI.tab = 'missions'; break;
  }
}
document.addEventListener('pointerdown', e => { if (e.target.closest('#panel')) UI.down = true; });
document.addEventListener('pointerup', () => { UI.down = false; });
document.addEventListener('pointercancel', () => { UI.down = false; });
document.addEventListener('click', e => {
  if (e.target.id === 'tacmap') { tacClick(e); return; }
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  audioInit(); sfxClick();
  doAct(b.dataset); UI.down = false; renderUI(true);
});
document.addEventListener('keydown', e => {
  if (!S || !S.started || e.target.closest('input,textarea')) return;
  if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); S.speed = S.speed ? 0 : 1; renderUI(true); }
  if (/^Digit[1-4]$/.test(e.code)) { S.speed = +e.code.slice(5); renderUI(true); }
});

// ---------- Main loop ----------
let lastNow = performance.now(), uiAcc = 0, saveAcc = 0;
function frame(now) {
  const dtR = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
  if (S.started && !S.over && !S.debrief) { let g = dtR * SPEEDS[S.speed]; while (g > 1e-6 && !S.debrief && !S.over) { const st = Math.min(0.25, g); step(st); g -= st; } }
  drawScene(now, dtR);
  audioFrame();
  if (UI.tab === 'tac') drawTac(now);
  uiAcc += dtR; if (uiAcc >= 0.25) { uiAcc = 0; renderUI(); }
  saveAcc += dtR; if (saveAcc >= 6) { saveAcc = 0; if (S.started || S.over) saveGame(); }
  requestAnimationFrame(frame);
}
function boot(data) {
  const hot = data && data.S;
  S = (hot && migrate(hot)) || loadGame() || newGame();
  const owed = syncRankPerks();
  if (owed) log(`Perk points for promotions you earned earlier: +${owed}. Spend them on the Base tab.`, 'good');
  if (!hot && S.started && !S.over) { UI.resume = true; S.started = false; }
  initScenery(); sizeScene();
  try { new ResizeObserver(sizeScene).observe(cv); } catch (e) { window.addEventListener('resize', sizeScene); }
  renderUI(true);
  requestAnimationFrame(frame);
}
try { window.claude?.hot?.snapshot?.(() => ({ S })); } catch (e) { /* not in a viewer */ }
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
