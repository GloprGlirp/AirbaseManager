// ---------- Campaign: 8-hour shifts, objectives, XP, ranks, unlocks ----------
const CAREER = [
  { name: 'Second Lieutenant',  short: '2nd Lt',   xp: 0,    unlocks: ['type:F-16C', 'type:KC-135R', 'up:hangar', 'up:fuelfarm'] },
  { name: 'First Lieutenant',   short: '1st Lt',   xp: 400,  unlocks: ['train:crew', 'up:shorad', 'up:bunker', 'type:F-15E'] },
  { name: 'Captain',            short: 'Capt',     xp: 1100,  unlocks: ['type:F/A-18E', 'train:pilot', 'up:quarters'] },
  { name: 'Major',              short: 'Maj',      xp: 2100, unlocks: ['type:A-10C', 'up:patriot'] },
  { name: 'Lieutenant Colonel', short: 'Lt Col',   xp: 3500, unlocks: ['type:E-3G'] },
  { name: 'Colonel',            short: 'Col',      xp: 5300, unlocks: ['type:F-35A'] },
  { name: 'Brigadier General',  short: 'Brig Gen', xp: 7500, unlocks: ['perk:budget'] },
];
const SHIFT_LEN = 480;
const SHIFT_NAMES = { 6: 'Day shift', 14: 'Swing shift', 22: 'Night shift' };
const OBJ_POOL = ['nolost', 'noraid', 'fuel', 'kills', 'sorties', 'rating', 'nofail'];
const isCampaign = () => S.mode === 'campaign';
function rankIdx(xp = S.xp || 0) { let r = 0; CAREER.forEach((c, i) => { if (xp >= c.xp) r = i; }); return r; }
function unlockName(key) {
  const [k, v] = key.split(':');
  if (k === 'type') return v;
  if (k === 'up') return UPGRADES[v].name;
  if (k === 'train') return v === 'crew' ? 'Ground crew training' : 'Pilot training';
  return 'Daily budget +50%';
}
function lockReason(key) {
  if (!isCampaign()) return null;
  const i = CAREER.findIndex(c => c.unlocks.includes(key));
  return i > rankIdx() ? `Unlocks at ${CAREER[i].name}` : null;
}
function budgetMul() { if (!isCampaign()) return 1; const r = rankIdx(); return 1 + 0.08 * r + (r >= 6 ? 0.5 : 0); }
function addXP(n) {
  if (!isCampaign() || !n) return;
  const before = rankIdx();
  S.xp += Math.round(n);
  for (let r = before + 1; r <= rankIdx(); r++) {
    S.funds += 500;
    log(`PROMOTED to ${CAREER[r].name}. Unlocked: ${CAREER[r].unlocks.map(unlockName).join(', ')}. $500K command bonus and 1 perk point.`, 'good');
  }
  syncRankPerks();
}

// One perk point per rank reached. Also pays out ranks earned before perks existed, without paying twice.
function syncRankPerks() {
  if (!isCampaign()) return 0;
  if (S.perkRankPaid == null) {
    const spent = Object.keys(S.perks || {}).reduce((n, k) => n + (PERKS[k] ? PERKS[k].cost : 0), 0);
    S.perkRankPaid = Math.min(rankIdx(), (S.perkPts || 0) + spent);
  }
  const owed = rankIdx() - S.perkRankPaid;
  if (owed <= 0) return 0;
  S.perkPts = (S.perkPts || 0) + owed; S.perkRankPaid += owed;
  return owed;
}
function mkObjective(id, n) {
  if (id === 'ops') return { id, n: Math.min(5, 2 + Math.floor(n / 3)) };
  if (id === 'fuel') return { id, n: Math.min(Math.round(capOf('fuel') * 0.45 / 10) * 10, 150 + 25 * Math.min(n, 8)) };
  if (id === 'kills') return { id, n: 2 + Math.floor(n / 2) };
  if (id === 'sorties') return { id, n: 4 + n };
  return { id };
}
function objText(o) {
  return { ops: `Complete ${o.n} operations`, nolost: 'Lose no aircraft', noraid: 'Keep every raid off the base',
    fuel: `End the shift with at least ${o.n} kL of fuel`, kills: `Shoot down ${o.n} enemy aircraft`, sorties: `Fly ${o.n} sorties`,
    rating: 'End with a higher command rating than you started', nofail: 'No failed or expired operations' }[o.id];
}
function objState(o) {
  const sh = S.shift, d = k => (S.stats[k] || 0) - (sh.s0[k] || 0);
  const count = (v, n) => ({ done: v >= n, label: `${Math.min(v, n)} / ${n}` });
  switch (o.id) {
    case 'ops': return count(d('won'), o.n);
    case 'kills': return count(d('kills'), o.n);
    case 'sorties': return count(d('sorties'), o.n);
    case 'nolost': { const v = d('lost'); return { done: !v, failed: v > 0, label: v ? `${v} lost` : 'On track' }; }
    case 'noraid': return { done: !sh.raidsHit, failed: sh.raidsHit > 0, label: sh.raidsHit ? `${sh.raidsHit} hit the base` : 'On track' };
    case 'nofail': { const v = d('failed') + d('expired'); return { done: !v, failed: v > 0, label: v ? `${v} failed` : 'On track' }; }
    case 'fuel': return { done: S.res.fuel >= o.n, label: `${Math.round(S.res.fuel)} / ${o.n} kL` };
    case 'rating': return { done: S.rep > sh.rep0, label: `${Math.round(S.rep)} vs ${Math.round(sh.rep0)}` };
  }
  return { done: false, label: '' };
}
function shiftName(t) { return SHIFT_NAMES[Math.round(hourOf(t)) % 24] || 'Shift'; }
function beginShift() {
  const n = (S.shiftsDone || 0) + 1, pool = OBJ_POOL.slice(), picks = [];
  while (picks.length < 2) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  S.shift = { n, name: shiftName(S.t), start: S.t, end: S.t + SHIFT_LEN, s0: { ...S.stats }, rep0: S.rep, xp0: S.xp, raidsHit: 0,
    objectives: [mkObjective('ops', n), ...picks.map(id => mkObjective(id, n))] };
  S.debrief = null;
  log(`${S.shift.name} ${n} begins. Objectives: ${S.shift.objectives.map(objText).join('; ')}.`);
}
function endShift() {
  const sh = S.shift, res = sh.objectives.map(o => objState(o).done), met = res.filter(Boolean).length;
  const missionXP = S.xp - sh.xp0, xp = 60 + met * 40 + (met === res.length ? 40 : 0), cash = met * 150, r0 = rankIdx();
  const d = k => (S.stats[k] || 0) - (sh.s0[k] || 0);
  S.funds += cash; S.shiftsDone = sh.n; S.stars = (S.stars || 0) + met;
  const perk = met === res.length; if (perk) S.perkPts = (S.perkPts || 0) + 1;
  addXP(xp);
  S.debrief = { perk, n: sh.n, name: sh.name, objectives: sh.objectives.map((o, i) => ({ text: objText(o), done: res[i] })), met, xp, missionXP, cash, r0, r1: rankIdx(),
    won: d('won'), kills: d('kills'), lost: d('lost'), raids: sh.raidsHit };
  log(`${sh.name} ${sh.n} complete: ${met} of ${res.length} objectives, +${xp + missionXP} XP.`, 'good');
}

// ---------- Clipboard beside the terminal ----------
function clipHTML() {
  if (!S) return '';
  const row = (text, st) => `<div class="ord ${st.done ? 'done' : st.failed ? 'failed' : ''}"><span class="box"></span><span>${text}</span><span class="st">${st.label}</span></div>`;
  if (isCampaign() && S.shift) {
    const sh = S.shift;
    return `<div class="sheet"><p class="when">Shift orders · ${sh.name} ${sh.n}</p><h3>${S.debrief ? 'Shift over' : `${fmtDur(sh.end - S.t)} left`}</h3>
      ${sh.objectives.map(o => row(objText(o), objState(o))).join('')}
      <p class="foot">Each objective: +40 XP and ${money(150)}. All three: +1 perk point.</p></div>`;
  }
  const ready = S.fleet.filter(a => !readiness(a) && !isSupportType(a.type)).length;
  const unanswered = S.raids.filter(r => { const m = MS(r.mission); return !(m && m.status === 'active'); }).length;
  const items = [
    ['Keep 2 jets ready for alerts', { done: ready >= 2, failed: ready === 0, label: `${ready} ready` }],
    ['Keep the fuel farm above 150 kL', { done: S.res.fuel >= 150, failed: S.res.fuel < 75, label: `${Math.round(S.res.fuel)} kL` }],
    ['Answer every raid with an intercept', { done: !unanswered, failed: unanswered > 0, label: S.raids.length ? (unanswered ? `${unanswered} raid${unanswered > 1 ? 's' : ''} unanswered` : 'All raids covered') : 'Sky clear' }],
    ['Fly the open operations', { done: !S.missions.some(m => m.status === 'open'), label: `${S.missions.filter(m => m.status === 'open').length} open` }],
  ];
  return `<div class="sheet"><p class="when">Standing orders · Kestrel Field</p><h3>${fmtClock(S.t)}</h3>${items.map(([t, st]) => row(t, st)).join('')}
    <p class="foot">${isCampaign() ? 'Shift orders appear here when your shift starts.' : 'Free play has no shift objectives.'}</p></div>`;
}

// ---------- Campaign screens ----------
function xpBar() {
  const r = rankIdx(), cur = CAREER[r], nxt = CAREER[r + 1];
  const p = nxt ? (S.xp - cur.xp) / (nxt.xp - cur.xp) : 1;
  return `<div class="xp"><div class="xpl"><b>${cur.name}</b><span>${S.xp} XP${nxt ? ` · ${nxt.xp - S.xp} to ${nxt.name}` : ' · highest rank'}</span></div>${progBar(p)}</div>`;
}
function debriefHTML() {
  const d = S.debrief, promo = d.r1 > d.r0;
  const unlocked = CAREER.slice(d.r0 + 1, d.r1 + 1).flatMap(c => c.unlocks).map(unlockName).join(', ');
  return `<div class="brief" role="dialog" aria-labelledby="ovt"><p class="h">Shift report · ${d.name} ${d.n}</p>
    <h1 id="ovt">${d.met === d.objectives.length ? 'Clean shift' : `${d.met} of ${d.objectives.length} objectives`}</h1>
    <div class="objs">${d.objectives.map(o => `<div><span>${o.text}</span><span class="chip ${o.done ? 'ok' : 'crit'}">${o.done ? 'Done' : 'Missed'}</span></div>`).join('')}</div>
    <p class="muted">${d.won} operations completed · ${d.kills} kills · ${d.lost} jets lost · ${d.raids} raids on the base</p>
    <p>+${d.missionXP} XP from operations, +${d.xp} XP for the shift${d.cash ? `, ${money(d.cash)} budget bonus` : ''}.${d.perk ? ' Clean shift: +1 perk point.' : ''}</p>
    ${promo ? `<p class="okc">Promoted to ${CAREER[d.r1].name}. Unlocked: ${unlocked}. +${d.r1 - d.r0} perk point${d.r1 - d.r0 > 1 ? 's' : ''}.</p>` : ''}
    ${xpBar()}
    <div class="acts"><button class="btn go big" data-act="nextshift">Start ${shiftName(S.t)} ${d.n + 1}</button></div></div>`;
}
function careerHTML() {
  const sh = S.shift, r = rankIdx();
  const objs = sh ? sh.objectives.map(o => { const st = objState(o); return `<div><span>${objText(o)}</span><span class="chip ${st.done ? 'ok' : st.failed ? 'crit' : 'idle'}">${st.label}</span></div>`; }).join('') : '';
  const ladder = CAREER.map((c, i) => `<div class="rk${i <= r ? ' got' : ''}${i === r ? ' cur' : ''}"><div><b>${c.name}</b><small>${c.xp.toLocaleString('en-US')} XP</small></div><span>${c.unlocks.map(unlockName).join(' · ')}</span></div>`).join('');
  return `<div class="secH"><h2>Career</h2><p>${S.shiftsDone || 0} shifts served · ${S.stars || 0} objectives met · ${S.perkPts || 0} perk points (spend them on the Base tab)</p></div>${xpBar()}
    ${sh ? `<div class="secH" style="margin-top:18px"><h2>${sh.name} ${sh.n}</h2><p>Ends ${fmtClock(sh.end)}, in ${fmtDur(sh.end - S.t)}. Each objective met: +40 XP and ${money(150)}.</p></div><div class="objs">${objs}</div>` : ''}
    <div class="secH" style="margin-top:18px"><h2>Ranks and unlocks</h2><p>XP comes from operations, kills and shift objectives.</p></div><div class="ladder">${ladder}</div>`;
}
