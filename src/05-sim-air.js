// ---------- Flights and combat ----------
const ALT_BURN = { LOW: 1.35, MED: 1, HIGH: 0.82 };
const AGGR = { DEF: 0.65, BAL: 1, AGG: 1.4 };
const ROE = { HOLD: 0.15, TIGHT: 1, FREE: 1.35 };
const F_ATK = { WEDGE: 1, LINE: 1.12, TRAIL: 0.9 };
const F_DEF = { WEDGE: 1, LINE: 1.05, TRAIL: 0.8 };
const A_ATK = { LOW: 0.85, MED: 1, HIGH: 1.15 };
const WX_NAME = { clear: 'clear skies', cloudy: 'broken cloud', rain: 'rain showers', fog: 'fog', storm: 'thunderstorms' };

function members(f) { return f.members.map(AC).filter(a => a && a.status === 'air'); }
function flightSpeed(f) { const ms = members(f); return ms.length ? Math.min(...ms.map(a => TYPES[a.type].speed)) : 15; }
function burnRate(a, f, combat) { return TYPES[a.type].burn * ALT_BURN[f.tac.alt] * (combat ? 1.7 : 1) * (f.tac.aggr === 'AGG' ? 1.08 : 1); }
function hasA2A(a) { return a.load.aim120 > 0 || a.load.aim9 > 0 || a.load.gun >= 100; }
function hasA2G(a) { return a.load.gbu12 > 0 || a.load.agm65 > 0 || (!!TYPES[a.type].gunStrike && a.load.gun >= 200); }
const isSupport = f => f.kind === 'TANKER' || f.kind === 'AWACS';
function awacsUp() { return S.flights.some(f => f.kind === 'AWACS' && f.state === 'station'); }
function wxMul() { return S.wx.kind === 'storm' ? 0.85 : S.wx.kind === 'fog' ? 0.9 : 1; }
function raidOf(m) { return S.raids.find(r => r.mission === m.id); }
function tankerOnStation() { return S.flights.find(f => f.kind === 'TANKER' && f.state === 'station' && f.offload >= 2); }

function flightTarget(f) {
  if (f.state === 'rtb') return { x: 0, y: 0 };
  if (f.state === 'tanking') { const t = FL(f.tanker); return t && t.state === 'station' ? { x: t.x, y: t.y } : null; }
  if (isSupport(f)) return { x: f.tx, y: f.ty };
  const m = MS(f.mission); if (!m) return { x: 0, y: 0 };
  if (m.type === 'INTERCEPT') { const r = raidOf(m); return r ? { x: r.x, y: r.y } : { x: 0, y: 0 }; }
  return { x: m.x, y: m.y };
}
function moveFlight(f, tg, dt) {
  const dx = tg.x - f.x, dy = tg.y - f.y, d = hyp(dx, dy), step = flightSpeed(f) * dt;
  if (d > 0.01) { f.hdg = Math.atan2(dy, dx); const k = Math.min(1, step / d); f.x += dx * k; f.y += dy * k; }
  return d;
}
function closeMission(m, status) { m.status = status; m.closedAt = S.t; m.flight = null; }
function goRTB(f, why) {
  if (f.state === 'rtb') return;
  f.state = 'rtb'; f.enemy = null;
  radio(`${f.call}: ${why}, RTB.`);
  const m = MS(f.mission);
  if (m && m.status === 'active') {
    m.status = 'open'; m.flight = null;
    const r = raidOf(m); if (r) r.engaged = null;
    S.rep = Math.max(0, S.rep - 2);
    log(`Op. ${m.op} aborted. Tasking reopened, rating −2.`, 'warn');
  }
}
function missionWin(m, f) {
  closeMission(m, 'done');
  S.funds += m.reward; S.rep = Math.min(100, S.rep + m.rep); S.stats.won++;
  log(`Op. ${m.op} complete. ${money(m.reward)} added to the budget, rating +${m.rep}${isCampaign() ? `, +${20 + m.threat * 10} XP` : ''}.`, 'good');
  addXP(20 + m.threat * 10);
  if (f) goRTB(f, 'mission complete');
}
function missionFail(m, why) {
  const f = FL(m.flight);
  closeMission(m, 'failed');
  const pen = m.rep + 3;
  S.rep = Math.max(0, S.rep - pen); S.stats.failed++;
  log(`Op. ${m.op} failed: ${why}. Rating −${pen}.`, 'crit');
  if (f) goRTB(f, 'mission scrubbed');
}
function bingo(f) {
  const d = hyp(f.x, f.y);
  return members(f).some(a => a.fuel < d / TYPES[a.type].speed * burnRate(a, f, false) + 7);
}
function shoot(a, f, skill) {
  let w, pk;
  if (a.load.aim120 > 0 && f.tac.alt !== 'LOW') { w = 'aim120'; pk = 0.52; }
  else if (a.load.aim9 > 0) { w = 'aim9'; pk = 0.6; }
  else if (a.load.gun >= 100) { w = 'gun'; pk = 0.3; }
  else return null;
  a.load[w] -= w === 'gun' ? 100 : 1;
  pk *= F_ATK[f.tac.form] * A_ATK[f.tac.alt] * (1 - a.fatigue / 260) * (1 - skill * 0.35) * wxMul() * (awacsUp() ? 1.12 : 1);
  if (f.tac.roe === 'FREE') pk *= 0.92;
  return { hit: Math.random() < pk, call: w === 'aim120' ? 'Fox Three' : w === 'aim9' ? 'Fox Two' : 'guns, guns' };
}
function defend(a, f, kind) {
  const cm = kind === 'radar' ? 'chaff' : 'flare';
  let ev = 0.3;
  if (a.load[cm] >= 4) { a.load[cm] -= 4; ev = 0.74; }
  const exp = F_DEF[f.tac.form] * (f.tac.aggr === 'AGG' ? 1.15 : f.tac.aggr === 'DEF' ? 0.8 : 1) * (TYPES[a.type].stealth ? 0.45 : 1) * (awacsUp() ? 0.9 : 1);
  return Math.random() < 1 - (1 - ev) * exp;
}
function hitAircraft(a, f, src) {
  a.cond -= rnd(25, 70) * (TYPES[a.type].armor || 1);
  if (a.cond <= 0) {
    a.cond = 0; a.status = 'lost'; a.flight = null; a.phase = null; a.fuel = 0;
    f.members = f.members.filter(id => id !== a.id);
    S.stats.lost++; S.rep = Math.max(0, S.rep - 12);
    log(`${a.call} shot down by ${src}. ${a.pilot} ejected and was recovered by CSAR. Rating −12.`, 'crit');
  } else radio(`${a.call}: I'm hit, ${Math.round(100 - a.cond)}% damage, still flying.`);
}
function airCombat(f, en, dt) {
  for (const a of members(f)) {
    if (en.n <= 0) break;
    if (Math.random() < 0.45 * AGGR[f.tac.aggr] * ROE[f.tac.roe] * dt) {
      const s = shoot(a, f, en.skill);
      if (s) {
        radio(`${a.call}: ${s.call}.`);
        if (s.hit) { en.n--; S.stats.kills++; addXP(4); radio(`${a.call}: splash one${en.n ? '' : ', picture clean'}.`); }
      }
    }
  }
  for (let i = 0; i < en.n; i++) {
    if (Math.random() >= 0.2 * (0.6 + en.skill) * dt) continue;
    const ms = members(f); if (!ms.length) return;
    const a = pick(ms), kind = Math.random() < 0.55 ? 'radar' : 'ir';
    if (defend(a, f, kind)) radio(`${a.call}: missile inbound, ${kind === 'radar' ? 'chaff' : 'flares'}, defeated.`);
    else hitAircraft(a, f, en.label);
  }
}
function samFire(f, sam, dt) {
  if (!sam) return;
  for (const a of members(f)) {
    if (Math.random() >= 0.07 * sam * ({ LOW: 0.8, MED: 1, HIGH: 1.1 }[f.tac.alt]) * (TYPES[a.type].stealth ? 0.5 : 1) * dt) continue;
    if (defend(a, f, Math.random() < 0.7 ? 'radar' : 'ir')) radio(`${a.call}: SAM launch, defending, missile defeated.`);
    else hitAircraft(a, f, 'a surface-to-air missile');
  }
}
function strikeRun(f, m, dt) {
  const ms = members(f);
  if (f.tac.roe !== 'HOLD') for (const a of ms) {
    if (Math.random() >= 0.5 * AGGR[f.tac.aggr] * dt) continue;
    const w = a.load.gbu12 > 0 ? 'gbu12' : a.load.agm65 > 0 ? 'agm65' : null;
    if (!w) {
      if (!TYPES[a.type].gunStrike || a.load.gun < 200) continue;
      a.load.gun -= 200;
      if (Math.random() < 0.55 * wxMul()) { m.hp -= 1.2; radio(`${a.call}: guns run, good effect on target.`); } else radio(`${a.call}: guns run, rounds long.`);
      continue;
    }
    a.load[w]--;
    const p = (w === 'gbu12' ? 0.72 : 0.7) * ({ LOW: 1.12, MED: 1, HIGH: 0.85 }[f.tac.alt]) * (1 - a.fatigue / 260) * wxMul();
    if (Math.random() < p) { m.hp -= w === 'gbu12' ? 2 : 1.6; radio(`${a.call}: ${w === 'gbu12' ? 'bombs away, good hits' : 'rifle, Maverick on target'}.`); }
    else radio(`${a.call}: ${WLBL[w]} went wide.`);
  }
  samFire(f, m.sam, dt);
  if (m.hp <= 0) return 'win';
  if (!members(f).some(hasA2G)) return 'winchester';
  return null;
}
function stepFlight(f, dt) {
  const ms = members(f);
  if (f.state === 'launch') {
    const all = f.members.map(AC).filter(a => a && a.status !== 'lost');
    if (!all.length) f.dead = true;
    else if (all.every(a => a.status === 'air')) { f.state = 'enroute'; radio(`${f.call}: flight airborne, proceeding.`); }
    return;
  }
  if (!ms.length) { f.dead = true; const m = MS(f.mission); if (m && m.status === 'active') missionFail(m, 'flight lost'); return; }
  const combat = f.state === 'engaged' || (f.state === 'station' && f.kind === 'STRIKE');
  for (const a of ms) { a.fuel = Math.max(0, a.fuel - burnRate(a, f, combat) * dt); a.fatigue = Math.min(100, a.fatigue + 0.6 * dt); }
  f.trT += dt; if (f.trT >= 1.5) { f.trT = 0; f.trail.push([f.x, f.y]); if (f.trail.length > 40) f.trail.shift(); }
  if (f.state === 'rtb') {
    if (moveFlight(f, { x: 0, y: 0 }, dt) < 5) {
      for (const a of ms) { a.status = 'arr'; a.phase = 'inbound'; a.phT = 0; }
      f.dead = true; radio(`${f.call}: overhead Kestrel, ${ms.length} for landing.`);
    }
    return;
  }
  if (f.state === 'tanking') {
    const tg = flightTarget(f);
    if (!tg) { f.state = 'enroute'; radio(`${f.call}: tanker left the track.`); return; }
    if (moveFlight(f, tg, dt) < 6 && (f.refT += dt) >= 3) {
      const t = FL(f.tanker); let off = t ? t.offload : 0;
      for (const a of ms) { const T = TYPES[a.type], g = Math.min((100 - a.fuel) / 100 * T.fuelKL, off); off -= g; a.fuel += g / T.fuelKL * 100; }
      if (t) t.offload = off;
      f.refT = 0; f.state = 'enroute'; radio(`${f.call}: tanking complete, back to the fight.`);
    }
    return;
  }
  if (isSupport(f)) {
    const d = moveFlight(f, flightTarget(f), dt);
    if (f.state === 'enroute' && d < 4) { f.state = 'station'; radio(f.kind === 'AWACS' ? `${f.call}: on station, picture is up. All flights, check in.` : `${f.call}: on station, tanker track open.`); }
    if (f.state === 'station') { f.stT += dt; f.x = f.tx + Math.cos(f.stT * 0.5) * 6; f.y = f.ty + Math.sin(f.stT * 0.5) * 6; f.hdg = f.stT * 0.5 + Math.PI / 2; }
    if (f.kind === 'TANKER' && f.offload < 2) goRTB(f, 'offload complete'); else if (bingo(f)) goRTB(f, 'bingo fuel');
    return;
  }
  const m = MS(f.mission);
  if (!m || m.status !== 'active') { goRTB(f, 'no tasking'); return; }
  if (bingo(f)) { goRTB(f, 'bingo fuel'); return; }
  if (ms.some(a => a.cond < 35)) { goRTB(f, 'battle damage'); return; }
  if (m.type === 'INTERCEPT') {
    const r = raidOf(m); if (!r) return;
    const range = (f.tac.alt === 'HIGH' ? 40 : 28) * (f.tac.form === 'LINE' ? 1.15 : 1) + (awacsUp() ? 15 : 0);
    if (f.state === 'enroute') {
      if (moveFlight(f, r, dt) < range) { f.state = 'engaged'; r.engaged = f.id; radio(`${f.call}: tally ${r.n} bandits, engaging.`); }
    } else if (f.state === 'engaged') {
      moveFlight(f, r, dt * 0.3); airCombat(f, r, dt);
      if (r.n <= 0) { S.raids = S.raids.filter(x => x !== r); missionWin(m, f); }
      else if (!members(f).some(hasA2A)) goRTB(f, 'Winchester, no weapons left');
    }
    return;
  }
  if (f.state === 'enroute') {
    if (moveFlight(f, m, dt) < 4) { f.state = 'station'; f.stT = 0; radio(`${f.call}: on station, Op. ${m.op}.`); }
    return;
  }
  if (f.state === 'station') {
    f.stT += dt; f.x = m.x + Math.cos(f.stT * 0.8) * 5; f.y = m.y + Math.sin(f.stT * 0.8) * 5; f.hdg = f.stT * 0.8 + Math.PI / 2;
    if (m.type === 'CAP') {
      if (Math.random() < m.threat * 0.035 * dt) {
        f.enemy = { n: irnd(1, Math.min(4, m.threat)), skill: rnd(0.2, 0.4 + m.threat * 0.08), label: 'enemy fighters' };
        f.state = 'engaged'; radio(`${f.call}: ${f.enemy.n} bandits, committing.`);
      } else if (f.stT >= m.dur) missionWin(m, f);
    } else if (m.type === 'RECON') {
      samFire(f, m.sam, dt);
      if (f.stT >= m.dur && members(f).length) missionWin(m, f);
    } else if (m.type === 'STRIKE') {
      const r = strikeRun(f, m, dt);
      if (r === 'win') missionWin(m, f); else if (r === 'winchester') goRTB(f, 'out of air-to-ground stores');
    }
    return;
  }
  if (f.state === 'engaged' && f.enemy) {
    airCombat(f, f.enemy, dt);
    if (f.enemy.n <= 0) { f.enemy = null; f.state = 'station'; radio(`${f.call}: resuming CAP.`); }
    else if (!members(f).some(hasA2A)) goRTB(f, 'Winchester, no weapons left');
  }
}
function orderTanker(f) {
  const t = tankerOnStation();
  if (!t || isSupport(f) || f.state === 'rtb' || f.state === 'launch' || f.state === 'tanking') return;
  const m = MS(f.mission); const r = m && raidOf(m); if (r && r.engaged === f.id) r.engaged = null;
  f.state = 'tanking'; f.tanker = t.id; f.refT = 0; f.enemy = null;
  radio(`${f.call}: heading to ${t.call} for fuel.`);
}

// ---------- Raids on the base ----------
function stepRaids(dt) {
  for (const r of S.raids) {
    const by = r.engaged && FL(r.engaged);
    if (by && by.state === 'engaged') continue;
    r.engaged = null;
    const d = hyp(r.x, r.y), k = Math.min(1, r.speed * dt / Math.max(d, 0.01));
    r.x -= r.x * k; r.y -= r.y * k;
    airDefense(r, hyp(r.x, r.y), dt);
    if (r.n <= 0) { raidDestroyedByBase(r); r.dead = true; }
    else if (d < 14) { baseAttack(r); r.dead = true; }
  }
  S.raids = S.raids.filter(r => !r.dead);
}
function airDefense(r, d, dt) {
  if (S.base.patriot && d < 80 && S.res.pac3 >= 1 && Math.random() < 0.35 * S.base.patriot * dt) {
    S.res.pac3--;
    const hit = Math.random() < 0.6; if (hit) r.n--;
    S.fx.push({ kind: 'sam', site: 'pat', i: irnd(0, S.base.patriot - 1), born: S.t, life: 1.6, dir: Math.sign(r.x) || 1 });
    radio(`Patriot: missile away${hit ? ', target destroyed' : ', missed'}. ${r.n} ${r.n === 1 ? 'bandit' : 'bandits'} remaining.`);
  }
  if (r.n > 0 && S.base.shorad && d < 22 && S.res.stinger >= 1 && Math.random() < 0.6 * S.base.shorad * dt) {
    S.res.stinger--;
    const hit = Math.random() < 0.45; if (hit) r.n--;
    S.fx.push({ kind: 'sam', site: 'sho', i: irnd(0, S.base.shorad - 1), born: S.t, life: 1.2, dir: Math.sign(r.x) || 1 });
    radio(`Avenger: Stinger away${hit ? ', splash one' : ', no kill'}.`);
  }
}
function raidDestroyedByBase(r) {
  const m = MS(r.mission);
  if (!m || !(m.status === 'open' || m.status === 'active')) return;
  const f = FL(m.flight);
  closeMission(m, 'done');
  const pay = Math.round(m.reward / 2);
  S.funds += pay; S.rep = Math.min(100, S.rep + m.rep); S.stats.won++;
  log(`Op. ${m.op}: raid wiped out by base air defences. ${money(pay)} bonus, rating +${m.rep}.`, 'good');
  addXP(10 + m.threat * 5);
  if (f) goRTB(f, 'raid destroyed');
}
function baseAttack(r) {
  if (S.shift) S.shift.raidsHit++;
  const sev = clamp(r.n / (r.n0 || r.n), 0.3, 1);
  const fuelLoss = Math.round(S.res.fuel * rnd(0.15, 0.3) * sev);
  S.res.fuel -= fuelLoss;
  const kits = Math.min(4, S.res.parts); S.res.parts -= kits;
  S.runway.closedUntil = S.t + (kits >= 4 ? 40 : 90);
  let extra = '';
  const parked = S.fleet.filter(a => a.status === 'ready' && !slotInfo(a.slot).hangar);
  if (parked.length && Math.random() < 0.6) { const a = pick(parked); a.cond = Math.max(5, a.cond - rnd(30, 60)); extra = ` ${a.call} damaged on the ramp.`; }
  S.fx.push({ kind: 'raid', born: S.t, life: 4 }, { kind: 'smoke', x: rnd(0.25, 0.75), at: 'rwy', born: S.t, life: 90 }, { kind: 'smoke', x: 0.915, at: 'farm', born: S.t, life: 140 });
  log(`AIR RAID on Kestrel Field. ${fuelLoss} kL of fuel burned, runway closed for ${fmtDur(S.runway.closedUntil - S.t)}.${extra}`, 'crit');
  const m = MS(r.mission); if (m && (m.status === 'open' || m.status === 'active')) missionFail(m, 'the raid reached the base');
}

// ---------- Tasking ----------
function genMission(type) {
  const day = Math.floor(S.t / 1440);
  if (!type) {
    const p = Math.min(0.35, 0.14 + day * 0.05), r = Math.random();
    type = r < p ? 'INTERCEPT' : r < p + 0.32 ? 'CAP' : r < p + 0.62 ? 'STRIKE' : 'RECON';
  }
  const threat = clamp(irnd(1, 3) + Math.floor(day / 2) + (Math.random() < 0.2 ? 1 : 0), 1, 5);
  const ang = rnd(0, Math.PI * 2), dist = rnd(70, 230);
  const used = new Set(S.missions.map(m => m.op));
  const m = { id: 'M' + (S.nextId++), op: pick(OPS.filter(o => !used.has(o))) || pick(OPS), type, threat,
    x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, status: 'open', flight: null, born: S.t };
  if (type === 'CAP') { m.dur = irnd(16, 26); m.reward = 200 + threat * 80; m.rep = 4; m.expires = S.t + 100; m.need = 'A2A';
    m.brief = `Hold a combat air patrol for ${m.dur} min. Expect up to ${Math.min(4, threat)} enemy fighters.`; }
  if (type === 'STRIKE') { m.hp = m.hp0 = 3 + threat; m.sam = threat; m.reward = 380 + threat * 120; m.rep = 6; m.expires = S.t + 160; m.need = 'STRIKE';
    m.brief = `Destroy ${pick(TARGETS)}. SAM threat level ${threat}. Needs GBU-12 or AGM-65 loads.`; }
  if (type === 'RECON') { m.dur = 4; m.sam = Math.max(0, threat - 2); m.reward = 140 + threat * 50; m.rep = 3; m.expires = S.t + 130; m.need = 'CAP';
    m.brief = `Overfly ${pick(RECON)} and hold ${m.dur} min for imagery. Light air defences.`; }
  if (type === 'INTERCEPT') {
    const d0 = rnd(250, 290) + (awacsUp() ? 45 : 0); m.x = Math.cos(ang) * d0; m.y = Math.sin(ang) * d0;
    const n = clamp(irnd(1, threat) + 1, 2, 6);
    m.reward = 300 + threat * 100; m.rep = 8; m.expires = null; m.need = 'A2A';
    m.brief = `${n} enemy fighters inbound to Kestrel Field. Intercept them before they reach the base.`;
    S.raids.push({ id: 'R' + (S.nextId++), mission: m.id, x: m.x, y: m.y, n, n0: n, skill: rnd(0.25, 0.4 + threat * 0.08), speed: rnd(7, 9.5), label: 'enemy fighters', engaged: null });
    log(`RADAR: ${n} hostile contacts bearing ${bearingName(m.x, m.y)}, ${Math.round(d0)} km, inbound. Op. ${m.op}: scramble.`, 'crit');
  }
  m.sector = sectorName(m.x, m.y);
  S.missions.push(m);
  if (type !== 'INTERCEPT') log(`New tasking: Op. ${m.op}, ${type.toLowerCase()} in sector ${m.sector}.`);
  return m;
}
function newWeather() {
  const r = Math.random();
  const kind = r < 0.45 ? 'clear' : r < 0.72 ? 'cloudy' : r < 0.88 ? 'rain' : r < 0.95 ? 'fog' : 'storm';
  S.wx = { kind, wind: Math.round(rnd(230, 310) / 10) * 10, kt: irnd(4, kind === 'storm' ? 28 : 16), until: S.t + rnd(150, 320) };
  log(`Weather: ${WX_NAME[kind]}, wind ${S.wx.wind}° at ${S.wx.kt} kt.`);
}
function threatLevel() {
  if (!S.raids.length) return 'GREEN';
  return Math.min(...S.raids.map(r => hyp(r.x, r.y))) < 150 ? 'RED' : 'AMBER';
}

// ---------- World step ----------
function step(dt) {
  S.t += dt;
  tickTasks(dt);
  tickGround(dt);
  for (const f of S.flights) stepFlight(f, dt);
  S.flights = S.flights.filter(f => !f.dead);
  stepRaids(dt);
  tickBase(dt);
  for (const m of S.missions) {
    if (m.status === 'open' && m.expires && S.t >= m.expires) {
      closeMission(m, 'expired'); S.rep = Math.max(0, S.rep - 3); S.stats.expired = (S.stats.expired || 0) + 1; log(`Op. ${m.op} expired unflown. Rating −3.`, 'warn');
    }
  }
  S.missions = S.missions.filter(m => m.status === 'open' || m.status === 'active' || S.t - m.closedAt < 45);
  if (S.t >= S.nextMission) {
    if (S.missions.filter(m => m.status === 'open' || m.status === 'active').length < 5) genMission();
    S.nextMission = S.t + rnd(28, 55) - Math.min(15, Math.floor(S.t / 1440) * 3);
  }
  const di = Math.floor((S.t - 360) / 1440);
  if (di > S.budgetDay) { S.budgetDay = di; const amt = Math.round((700 + S.rep * 6) * budgetMul()); S.funds += amt; log(`06:00 budget allocation: ${money(amt)}.`, 'good'); }
  if (S.t >= S.wx.until) newWeather();
  S.fx = S.fx.filter(x => S.t - x.born < x.life);
  if (isCampaign() && S.shift && !S.debrief && !S.over && S.t >= S.shift.end) endShift();
  if (S.rep <= 0 && !S.over) { S.over = true; log('Command rating reached zero. You have been relieved of command.', 'crit'); }
}
