// ---------- Terminal panels ----------
const UI = { tab: 'missions', selM: null, pick: new Set(), tac: { ...DEFAULT_TAC }, selF: null, lastTab: null, lastHTML: '', lastSide: '', down: false, resume: false };
const TYPE_NAME = { CAP: 'Combat air patrol', STRIKE: 'Strike', RECON: 'Reconnaissance', INTERCEPT: 'Intercept', TANKER: 'Tanker track', AWACS: 'AWACS orbit' };
const FSTATE = { launch: 'Taking off', enroute: 'En route', station: 'On station', engaged: 'Engaged', rtb: 'Returning to base', tanking: 'Going to tanker' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function gauge(frac, cls = '', pend = 0) {
  const w = clamp(frac * 100, 0, 100);
  return `<div class="gauge ${cls}"><i style="width:${w.toFixed(1)}%"></i>${pend > 0 ? `<u style="left:${w.toFixed(1)}%;width:${clamp(pend * 100, 0, 100 - w).toFixed(1)}%"></u>` : ''}</div>`;
}
const lvl = f => f < 0.15 ? 'crit' : f < 0.35 ? 'low' : '';
const pips = n => `<span class="pips" title="Threat ${n} of 5">${'▮'.repeat(n)}<s>${'▮'.repeat(5 - n)}</s></span>`;
const seg = (act, cur, opts, extra = '') => `<div class="seg">${opts.map(([v, l]) => `<button class="btn${v === cur ? ' on' : ''}" data-act="${act}" data-v="${v}" ${extra}>${l}</button>`).join('')}</div>`;

function acState(a) {
  if (a.status === 'ordered') return ['idle', 'On order'];
  if (a.status === 'lost') return ['crit', a.replacing ? 'Replacement due' : 'Lost'];
  if (a.status === 'dep') return ['air', { taxi: 'Taxiing', hold: 'Holding short', roll: 'Takeoff roll', climb: 'Climbing out' }[a.phase] || 'Departing'];
  if (a.status === 'air') { const f = FL(a.flight); return ['air', f ? FSTATE[f.state] : 'Airborne']; }
  if (a.status === 'arr') return ['air', { inbound: 'In the pattern', final: 'On final', rollout: 'Landing', taxiin: 'Taxiing in' }[a.phase] || 'Inbound'];
  if (a.task) return ['warn', { refuel: 'Refuelling', arm: 'Arming', repair: 'In repair' }[a.task.kind]];
  if (a.queue.length) return ['warn', 'Waiting for crew'];
  const r = readiness(a); if (r) return [a.cond < 50 ? 'crit' : 'warn', r.split(',')[0]];
  if (!isSupportType(a.type) && !['aim120', 'aim9', 'agm65', 'gbu12'].some(k => a.load[k] > 0)) return ['warn', 'Unarmed'];
  return ['ok', 'Ready'];
}
function loadLine(a) {
  if (TYPES[a.type].tanker) return `<span>Boom offload <b>40 kL</b></span><span>Crew <b>3</b></span>`;
  if (TYPES[a.type].awacs) return `<span>Radar orbit <b>55 km out</b></span><span>Boosts every flight</span>`;
  const p = [];
  for (const k of ['aim120', 'aim9', 'agm65', 'gbu12']) if (a.load[k]) p.push(`<span>${WLBL[k]} <b>${a.load[k]}</b></span>`);
  if (!p.length) p.push('<span>No missiles or bombs</span>');
  p.push(`<span>20mm <b>${a.load.gun}</b></span>`, `<span>Chaff/flare <b>${a.load.chaff}/${a.load.flare}</b></span>`);
  return p.join('');
}

function supplyHTML() {
  const rows = RES_KEYS.filter(k => capOf(k) > 0).map(k => {
    const R = RES_DEF[k], cap = capOf(k), q = S.res[k], f = q / cap, pend = pending(k), blk = orderBlock(k);
    return `<div class="res"><div class="nm"><b>${R.name}</b><small>${R.note}</small></div>
      ${gauge(f, lvl(f), pend / cap)}
      <div class="qty">${fmtQ(k, q).replace(/ \w+$/, '')}<small> / ${fmtQ(k, cap)}</small></div>
      <button class="btn" data-act="order" data-k="${k}" ${blk ? 'disabled' : ''} title="${blk || ''}">+${fmtQ(k, R.pack)} · ${money(R.cost)} · ${fmtDur(R.eta)}</button></div>`;
  }).join('');
  const inbound = [
    ...S.cargo.filter(c => c.items.length).map(c => [c.call + ' · ' + ({ inbound: 'in the pattern', final: 'on final', rollout: 'landing', taxiin: 'taxiing in', unload: 'unloading' }[c.phase] || 'on the ramp'), c.items]),
    ...S.deliveries.slice().sort((a, b) => a.at - b.at).map(d => [`Airlift ETA ${fmtClock(d.at)} (${fmtDur(d.at - S.t)})`, d.items]),
  ];
  const closed = S.t < S.runway.closedUntil;
  return `<div class="secH"><h2>Stores and fuel</h2><p>Hatched bar: on order. Deliveries land on runway 27 by C-130.</p></div>${rows}
  <div class="cols2">
    <div><p class="h">Inbound deliveries</p><div class="list" style="margin-top:8px">${inbound.length ? inbound.map(([t, it]) => `<div><span>${esc(t)}</span><span class="muted">${it.map(([k, q]) => fmtQ(k, q) + ' ' + RES_DEF[k].short).join(', ')}</span></div>`).join('') : '<div><span class="muted">Nothing on order.</span></div>'}</div></div>
    <div><p class="h">Base status</p><dl class="kv" style="margin-top:8px">
      <dt>Runway 27</dt><dd class="${closed ? 'critc' : 'okc'}">${closed ? `Closed, crater repair ${fmtDur(S.runway.closedUntil - S.t)}` : 'Open'}</dd>
      <dt>Ground crews</dt><dd>${crewsBusy()} of ${S.crews} working</dd>
      <dt>Air defence</dt><dd>${S.base.patriot || S.base.shorad ? `${S.base.patriot} Patriot, ${S.base.shorad} Avenger` : 'None. Build it on the Base tab.'}</dd>
      <dt>Weather</dt><dd>${WX_NAME[S.wx.kind]}, ${S.wx.wind}° / ${S.wx.kt} kt</dd>
      <dt>Next budget</dt><dd>06:00, about ${money((700 + S.rep * 6) * budgetMul())}</dd>
      <dt>Record</dt><dd>${S.stats.won} won · ${S.stats.failed} failed · ${S.stats.kills} kills · ${S.stats.lost} jets lost</dd>
    </dl></div>
  </div>`;
}

function flightlineHTML() {
  const cards = S.fleet.map(a => {
    const [cls, label] = acState(a), T = TYPES[a.type], parked = a.status === 'ready';
    let task = '';
    if (a.task) task = `${label}, ${fmtDur(a.task.dur - a.task.t)} left`;
    if (a.queue.length) task += `${task ? ' · then ' : 'Queued: '}${a.queue.map(q => q.kind === 'arm' ? 'arm ' + LO_NAME[q.arg] : q.kind).join(', ')}`;
    let acts = '';
    if (a.status === 'ordered') acts = `<span class="muted">Ferry flight arrives ${fmtClock(a.replacing)}</span>`;
    else if (a.status === 'lost') acts = a.replacing ? `<span class="muted">Ferry flight arrives ${fmtClock(a.replacing)}</span>` : `<button class="btn" data-act="replace" data-id="${a.id}" ${S.funds < replaceCost(a) ? 'disabled' : ''}>Request replacement · ${money(replaceCost(a))}</button>`;
    else if (parked) {
      acts = `<button class="btn go" data-act="turn" data-id="${a.id}">Turnaround</button>
        <button class="btn" data-act="refuel" data-id="${a.id}" ${a.fuel >= 99.5 || S.res.fuel < 0.1 ? 'disabled' : ''}>Refuel</button>
        <button class="btn" data-act="repair" data-id="${a.id}" ${a.cond >= 99.5 || S.res.parts < 1 ? 'disabled' : ''}>Repair</button>`;
      if (T.tanker || T.awacs) acts += `<button class="btn cy" data-act="tanker" data-id="${a.id}" ${readiness(a) ? 'disabled' : ''}>${T.awacs ? 'Launch AWACS orbit' : 'Launch to tanker track'}</button>`;
      else acts += seg('arm', a.loadout, Object.keys(T.loadouts).map(k => [k, k]), `data-id="${a.id}"`);
      if (S.pilots.some(p => p.fatigue < a.fatigue - 10)) acts += `<button class="btn" data-act="swap" data-id="${a.id}">Swap pilot</button>`;
    } else if (a.flight) acts = `<button class="btn cy" data-act="maps" data-f="${a.flight}">Show on tac map</button>`;
    return `<article class="ac${a.status === 'lost' ? ' lost' : ''}">
      <header><span class="call">${a.call}</span><span class="chip ${cls}">${label}</span></header>
      <div class="sub">${a.type} · ${a.tail} · ${a.pilot}${a.loadout ? ' · ' + LO_NAME[a.loadout] : ''}</div>
      <div class="bars"><span>Fuel</span>${gauge(a.fuel / 100, lvl(a.fuel / 100))}<em>${Math.round(a.fuel)}%</em>
        <span>Airframe</span>${gauge(a.cond / 100, a.cond < 50 ? 'crit' : a.cond < 80 ? 'low' : '')}<em>${Math.round(a.cond)}%</em>
        <span>Fatigue</span>${gauge(a.fatigue / 100, a.fatigue > 80 ? 'crit' : a.fatigue > 55 ? 'low' : '')}<em>${Math.round(a.fatigue)}%</em></div>
      <div class="load">${loadLine(a)}</div>
      <div class="task">${task}</div>
      <div class="acts">${acts}</div></article>`;
  }).join('');
  return `<div class="secH"><h2>Flightline</h2><p>${crewsBusy()} of ${S.crews} ground crews working · ${S.fleet.length} of ${slotCount()} parking spaces · Turnaround queues repair, fuel and stores · A2A, CAP and STRIKE set the weapons load</p></div><div class="grid">${cards}</div>`;
}

function etaText(m) {
  if (m.type === 'INTERCEPT') { const r = raidOf(m); return r ? `Raid reaches base in ${fmtDur((hyp(r.x, r.y) - 14) / r.speed)}` : ''; }
  return m.expires ? `Expires in ${fmtDur(m.expires - S.t)}` : '';
}
function mPos(m) { const r = m.type === 'INTERCEPT' && raidOf(m); return r ? r : m; }
function missionsHTML() {
  const live = S.missions.filter(m => m.status === 'open' || m.status === 'active')
    .sort((a, b) => (b.type === 'INTERCEPT') - (a.type === 'INTERCEPT') || (a.status === 'active') - (b.status === 'active') || (a.expires || 0) - (b.expires || 0));
  if (UI.selM && !live.some(m => m.id === UI.selM)) UI.selM = null;
  if (!UI.selM && live.length) UI.selM = live[0].id;
  const recent = S.missions.filter(m => !(m.status === 'open' || m.status === 'active')).slice(-4).reverse();
  const items = live.map(m => {
    const p = mPos(m), f = FL(m.flight);
    return `<button class="mi${m.id === UI.selM ? ' sel' : ''}${m.type === 'INTERCEPT' ? ' int' : ''}" data-act="selm" data-id="${m.id}">
      <span class="t">Op. ${m.op}</span><span class="ty">${TYPE_NAME[m.type]}</span>
      <small>Sector ${sectorName(p.x, p.y)} · ${Math.round(hyp(p.x, p.y))} km · ${pips(m.threat)}</small>
      <small class="${f ? 'cyc' : m.type === 'INTERCEPT' ? 'critc' : ''}">${f ? f.call + ': ' + FSTATE[f.state].toLowerCase() : etaText(m)}</small></button>`;
  }).join('');
  const left = `<div class="mlist">${items || '<div class="empty">No tasking right now. New orders arrive every 30 to 60 minutes. Use the time to turn jets around and stock up.</div>'}
    ${recent.length ? `<p class="h" style="margin-top:8px">Recent</p>${recent.map(m => `<small class="${m.status === 'done' ? 'okc' : m.status === 'failed' ? 'critc' : 'warnc'}">Op. ${m.op}: ${m.status === 'done' ? 'complete' : m.status}</small>`).join('')}` : ''}</div>`;
  const m = MS(UI.selM);
  return `<div class="secH"><h2>Tasking</h2><p>Pick an operation, assign aircraft, set tactics, launch.</p></div><div class="msplit">${left}${m ? planHTML(m) : ''}</div>`;
}
function planHTML(m) {
  const p = mPos(m), d = hyp(p.x, p.y);
  const head = `<div><p class="h">${TYPE_NAME[m.type]} · Sector ${sectorName(p.x, p.y)} · ${Math.round(d)} km</p><h3>Op. ${m.op}</h3></div><p>${m.brief}</p>
    <div class="est"><span>Reward <b>${money(m.reward)}</b></span><span>Rating <b>+${m.rep}</b></span><span>Threat ${pips(m.threat)}</span><span>Suggested load <b>${LO_NAME[m.need]}</b></span>${m.type === 'STRIKE' && m.hp < m.hp0 ? `<span>Target damage <b>${Math.round((1 - m.hp / m.hp0) * 100)}%</b></span>` : ''}</div>`;
  if (m.status === 'active') {
    const f = FL(m.flight);
    return `<div class="plan">${head}${f ? `<p class="cyc">${f.call}: ${FSTATE[f.state].toLowerCase()}.</p>
      <div class="acts"><button class="btn cy" data-act="maps" data-f="${f.id}">Open tac map</button><button class="btn red" data-act="rtb" data-f="${f.id}">Recall flight</button></div>` : ''}</div>`;
  }
  for (const id of [...UI.pick]) if (readiness(AC(id))) UI.pick.delete(id);
  const picks = S.fleet.filter(a => !isSupportType(a.type) && a.status !== 'ordered').map(a => {
    const r = readiness(a);
    return `<button class="pk${UI.pick.has(a.id) ? ' on' : ''}" data-act="pick" data-id="${a.id}" ${r ? 'disabled' : ''}><span>${a.call}</span><small>${r || `${a.loadout || 'Unarmed'} · fuel ${Math.round(a.fuel)}%`}</small></button>`;
  }).join('');
  const tact = Object.entries(TAC_OPTS).map(([k, o]) => `<div><p class="h">${o.label}</p>${seg('tac', UI.tac[k], o.opts, `data-k="${k}"`)}<small>${TAC_HELP[k][UI.tac[k]]}</small></div>`).join('');
  const chosen = [...UI.pick].map(AC);
  const spd = chosen.length ? Math.min(...chosen.map(a => TYPES[a.type].speed)) : 15;
  const station = m.type === 'CAP' ? m.dur : m.type === 'RECON' ? m.dur : m.type === 'STRIKE' ? 8 : 6;
  const fuelNeed = chosen.length ? Math.max(...chosen.map(a => TYPES[a.type].burn * ALT_BURN[UI.tac.alt] * (d * 2 / spd + station * 1.4))) : 0;
  let warn = '';
  if (chosen.length) {
    if (m.type === 'STRIKE' && !chosen.some(hasA2G)) warn = 'No bombs or Mavericks loaded. This strike cannot succeed.';
    else if (m.type !== 'STRIKE' && !chosen.some(a => a.load.aim120 > 0 || a.load.aim9 > 0)) warn = 'No air-to-air missiles loaded.';
    else if (chosen.some(a => a.fuel < fuelNeed + 7)) warn = 'Fuel is tight. Expect an early RTB or plan a tanker.';
  }
  return `<div class="plan">${head}
    <div><p class="h">Assign aircraft (up to 4)</p><div class="pick" style="margin-top:6px">${picks}</div></div>
    <div class="tact">${tact}</div>
    <div class="est"><span>Transit <b>${fmtDur(d / spd)}</b> each way</span><span>Fuel needed <b>~${Math.round(fuelNeed)}%</b></span>${m.type === 'INTERCEPT' ? `<span class="critc">${etaText(m)}</span>` : `<span>${etaText(m)}</span>`}</div>
    <div class="acts"><button class="btn go big" data-act="launch" ${chosen.length ? '' : 'disabled'}>${chosen.length ? `Launch ${chosen.length} aircraft` : 'Select aircraft to launch'}</button><span class="warnc">${warn}</span></div></div>`;
}

function tacSideHTML() {
  const fl = S.flights;
  if (UI.selF && !FL(UI.selF)) UI.selF = null;
  if (!UI.selF && fl.length) UI.selF = fl[0].id;
  const list = fl.map(f => `<button class="fl${f.id === UI.selF ? ' on' : ''}" data-act="self" data-id="${f.id}"><span>${f.call}</span><span class="muted">${FSTATE[f.state]}</span></button>`).join('');
  const f = FL(UI.selF);
  let det = '';
  if (f) {
    const m = MS(f.mission), ms = f.members.map(AC).filter(Boolean), t = tankerOnStation();
    det = `<div><p class="h">${isSupport(f) ? TYPE_NAME[f.kind] : m ? 'Op. ' + m.op + ' · ' + TYPE_NAME[m.type] : 'No tasking'}</p>
      <p style="margin:4px 0 0">${FSTATE[f.state]}${f.state !== 'launch' ? ` · ${bearingName(f.x, f.y)} ${Math.round(hyp(f.x, f.y))} km from base` : ''}${f.enemy ? ` · <span class="critc">${f.enemy.n} bandits</span>` : ''}${f.kind === 'TANKER' ? ` · offload ${Math.round(f.offload)} kL` : ''}</p></div>
      <div class="mem">${ms.map(a => `<span>${a.call}</span><span class="${a.fuel < 25 ? 'critc' : ''}">F ${Math.round(a.fuel)}%</span><span class="${a.cond < 50 ? 'critc' : ''}">A ${Math.round(a.cond)}%</span>
        <span class="muted" style="grid-column:1/-1">${isSupportType(a.type) ? a.type : `${a.load.aim120}× AIM-120 · ${a.load.aim9}× AIM-9X${a.load.gbu12 || a.load.agm65 ? ` · ${a.load.gbu12}× GBU-12 · ${a.load.agm65}× AGM-65` : ''} · CM ${a.load.chaff}/${a.load.flare}`}</span>`).join('')}</div>
      ${!isSupport(f) ? Object.entries(TAC_OPTS).map(([k, o]) => `<div><p class="h">${o.label}</p>${seg('ftac', f.tac[k], o.opts, `data-k="${k}" data-f="${f.id}"`)}</div>`).join('') : ''}
      <div class="acts">${f.state !== 'rtb' && f.state !== 'launch' ? `<button class="btn red" data-act="rtb" data-f="${f.id}">Order RTB</button>` : ''}
        ${!isSupport(f) && t && !['rtb', 'launch', 'tanking'].includes(f.state) ? `<button class="btn cy" data-act="tank" data-f="${f.id}">Refuel at ${t.call}</button>` : ''}</div>`;
  }
  return `<p class="h">Airborne flights</p>${list || '<div class="empty">Nothing airborne. Launch a flight from Tasking, or put the tanker up.</div>'}${det}
    <p class="muted" style="font-size:11px;line-height:1.5;margin:6px 0 0">Click a flight to select it. Click an operation marker to plan it. Range rings every 100 km.</p>`;
}
function logHTML() {
  return `<div class="secH"><h2>Comms and events</h2><p>Newest first.</p></div><div class="log">${S.log.slice(-140).reverse().map(l => `<div><time>${fmtT(l.t)}</time><span class="${l.cls}">${esc(l.msg)}</span></div>`).join('')}</div>`;
}

// ---------- Base tab: construction, personnel, procurement ----------
const lvlPips = (n, max) => `<span class="lvl" title="${n} of ${max} built">${'▮'.repeat(n)}<s>${'▮'.repeat(max - n)}</s></span>`;
const progBar = p => `<div class="prog"><i style="width:${(clamp(p, 0, 1) * 100).toFixed(1)}%"></i></div>`;
const cardHead = (title, side, size = 20) => `<header><span class="call" style="font-size:${size}px">${title}</span>${side}</header>`;
function baseHTML() {
  const bld = S.build, tr = S.training;
  const bStatus = bld
    ? `<p>Building ${UPGRADES[bld.key].name} ${S.base[bld.key] + 1}. Ready ${fmtClock(bld.done)}, in ${fmtDur(bld.done - S.t)}.</p>${progBar((S.t - bld.start) / (bld.done - bld.start))}`
    : '<p class="muted">Engineers are free. Pick a project.</p>';
  const ups = Object.entries(UPGRADES).map(([k, U]) => {
    const blk = buildBlock(k), n = S.base[k];
    const btn = n >= U.max ? '<span class="muted">Fully built</span>' : `<button class="btn go" data-act="build" data-k="${k}" ${blk ? 'disabled' : ''}>Build · ${money(U.cost)} · ${fmtDur(U.time)}</button>`;
    return `<article class="ac">${cardHead(U.name, lvlPips(n, U.max))}<div class="sub">${U.note}</div><div class="acts">${btn}${blk && blk !== 'Engineers busy' ? `<span class="warnc">${blk === 'No budget' ? 'Not enough budget' : blk}</span>` : ''}</div></article>`;
  }).join('');
  const tStatus = tr
    ? `<p>Training ${tr.kind === 'crew' ? 'a ground crew' : 'a pilot'}. Qualified ${fmtClock(tr.done)}, in ${fmtDur(tr.done - S.t)}.</p>${progBar((S.t - tr.start) / (tr.done - tr.start))}`
    : '<p class="muted">Instructors are free.</p>';
  const cb = trainBlock('crew'), pb = trainBlock('pilot');
  const spare = S.pilots.length
    ? S.pilots.map(p => `<div><span>${esc(p.name)}</span><span class="${p.fatigue > 55 ? 'warnc' : 'okc'}">fatigue ${Math.round(p.fatigue)}%</span></div>`).join('')
    : '<div><span class="muted">No spare pilots yet. Tired pilots keep flying.</span></div>';
  const people = `<div class="grid">
    <article class="ac">${cardHead('Ground crews', `<span class="chip ok">${S.crews} of ${CREW_MAX}</span>`)}<div class="sub">Each crew refuels, arms or repairs one jet at a time. ${crewsBusy()} working now.</div>
      <div class="acts"><button class="btn go" data-act="train" data-k="crew" ${cb ? 'disabled' : ''}>Train crew · ${money(CREW_COST)} · ${fmtDur(CREW_TIME)}</button>${cb && cb.startsWith('Unlocks') ? `<span class="warnc">${cb}</span>` : ''}</div></article>
    <article class="ac">${cardHead('Spare pilots', `<span class="chip ok">${S.pilots.length} of ${PILOT_MAX}</span>`)}<div class="sub">Swap a rested pilot into a tired jet from the Flightline.</div><div class="list">${spare}</div>
      <div class="acts"><button class="btn go" data-act="train" data-k="pilot" ${pb ? 'disabled' : ''}>Train pilot · ${money(PILOT_COST)} · ${fmtDur(PILOT_TIME)}</button>${pb && pb.startsWith('Unlocks') ? `<span class="warnc">${pb}</span>` : ''}</div></article></div>`;
  const shop = SHOP.map(t => {
    const T = TYPES[t], blk = buyBlock(t), owned = S.fleet.filter(a => a.type === t && a.status !== 'lost').length;
    const loads = Object.keys(T.loadouts).join(' · ') || (T.tanker ? 'Fuel offload' : 'Radar orbit');
    return `<article class="ac">${cardHead(t, `<span class="chip idle">${owned} in service</span>`, 22)}<div class="sub">${T.role}</div>
      <div class="stats3"><span>Speed<b>${Math.round(T.speed * 60)} km/h</b></span><span>Fuel<b>${T.fuelKL} kL</b></span><span>Loads<b>${loads}</b></span></div>
      <div class="acts"><button class="btn go" data-act="buy" data-k="${t}" ${blk ? 'disabled' : ''}>Buy · ${money(T.price)}</button>${blk ? `<span class="warnc">${blk}</span>` : ''}</div></article>`;
  }).join('');
  return `<div class="secH"><h2>Construction</h2><p>One engineer team works on one project at a time.</p></div>${bStatus}<div class="grid" style="margin-top:10px">${ups}</div>
    <div class="secH" style="margin-top:22px"><h2>Personnel</h2><p>One training class at a time.</p></div>${tStatus}<div style="margin-top:10px">${people}</div>
    <div class="secH" style="margin-top:22px"><h2>Procurement</h2><p>Parking ${S.fleet.length} of ${slotCount()} used. Hangars add space. New jets arrive by ferry flight after ${fmtDur(REPLACE_ETA)}.</p></div><div class="grid">${shop}</div>`;
}
