// ---------- Base development, training, procurement ----------
function buildBlock(k) {
  const U = UPGRADES[k];
  if (S.base[k] >= U.max) return 'Fully built';
  const lk = lockReason('up:' + k); if (lk) return lk;
  if (S.build) return 'Engineers busy';
  if (S.funds < U.cost) return 'No budget';
  return null;
}
function startBuild(k) {
  if (buildBlock(k)) return;
  const U = UPGRADES[k];
  S.funds -= U.cost;
  S.build = { key: k, start: S.t, done: S.t + U.time };
  log(`Engineers started work: ${U.name} ${S.base[k] + 1}. Ready in ${fmtDur(U.time)}.`);
}
function trainBlock(kind) {
  const lk = lockReason('train:' + kind); if (lk) return lk;
  if (S.training) return 'Instructors busy';
  if (kind === 'crew' && S.crews >= CREW_MAX) return 'Crew limit reached';
  if (kind === 'pilot' && S.pilots.length >= PILOT_MAX) return 'Pilot pool full';
  if (S.funds < (kind === 'crew' ? CREW_COST : PILOT_COST)) return 'No budget';
  return null;
}
function startTraining(kind) {
  if (trainBlock(kind)) return;
  const cost = kind === 'crew' ? CREW_COST : PILOT_COST, time = kind === 'crew' ? CREW_TIME : PILOT_TIME;
  S.funds -= cost;
  S.training = { kind, start: S.t, done: S.t + time };
  log(`Training started: ${kind === 'crew' ? 'new ground crew' : 'new pilot'}, qualified in ${fmtDur(time)}.`);
}
function swapPilot(a) {
  if (!a || a.status !== 'ready' || !S.pilots.length) return;
  const best = S.pilots.slice().sort((x, y) => x.fatigue - y.fatigue)[0];
  if (best.fatigue >= a.fatigue) return;
  S.pilots.splice(S.pilots.indexOf(best), 1);
  S.pilots.push({ name: a.pilot, fatigue: a.fatigue });
  log(`${best.name} takes over ${a.call}. ${a.pilot} goes to crew rest.`);
  a.pilot = best.name; a.fatigue = best.fatigue;
}
function buyBlock(type) {
  const lk = lockReason('type:' + type); if (lk) return lk;
  if (freeSlot(type) < 0) return 'No parking, build a hangar';
  if (S.funds < TYPES[type].price) return 'No budget';
  return null;
}
function buyAircraft(type) {
  if (buyBlock(type)) return;
  const T = TYPES[type];
  S.funds -= T.price;
  const n = S.fleet.filter(a => a.type === type).length + 1;
  const a = { id: 'A' + (S.nextId++), call: `${T.call} ${T.grp}-${n}`, type, tail: `${irnd(86, 99)}-0${irnd(100, 999)}`, pilot: newPilotName(),
    slot: freeSlot(type), status: 'ordered', phase: null, phT: 0, task: null, queue: [], fuel: 60, cond: 100, fatigue: 25,
    loadout: null, load: mkLoad(type, null), flight: null, replacing: S.t + REPLACE_ETA };
  S.fleet.push(a);
  log(`Ordered a ${type} for ${money(T.price)}. ${a.call} arrives on a ferry flight in ${fmtDur(REPLACE_ETA)}.`);
}
function tickBase(dt) {
  const rest = S.base.quarters ? 0.6 : 0.3;
  for (const a of S.fleet) {
    if (a.status === 'ready') a.fatigue = Math.max(0, a.fatigue - rest * dt);
    if ((a.status === 'lost' || a.status === 'ordered') && a.replacing && S.t >= a.replacing) {
      const fresh = a.status === 'ordered';
      Object.assign(a, { status: 'arr', phase: 'inbound', phT: 0, fuel: 55, cond: 100, fatigue: fresh ? a.fatigue : 30, loadout: null, load: mkLoad(a.type, null), replacing: null });
      if (!fresh) a.tail = `${irnd(86, 96)}-0${irnd(100, 999)}`;
      radio(`${a.call}: ${fresh ? 'new' : 'replacement'} ${a.type} on ferry flight, inbound Kestrel.`);
    }
  }
  for (const p of S.pilots) p.fatigue = Math.max(0, p.fatigue - rest * dt);
  if (S.build && S.t >= S.build.done) {
    const k = S.build.key, U = UPGRADES[k];
    S.base[k]++; S.build = null;
    if (k === 'patriot') S.res.pac3 = Math.min(capOf('pac3'), S.res.pac3 + 4);
    if (k === 'shorad') S.res.stinger = Math.min(capOf('stinger'), S.res.stinger + 6);
    log(`${U.name} ${S.base[k]} is complete.${k === 'patriot' ? ' Delivered with 4 interceptors.' : k === 'shorad' ? ' Delivered with 6 Stingers.' : k === 'hangar' ? ' Two more aircraft spaces.' : ''}`, 'good');
  }
  if (S.training && S.t >= S.training.done) {
    if (S.training.kind === 'crew') { S.crews++; log(`A new ground crew has qualified. ${S.crews} crews on the flightline.`, 'good'); }
    else { const name = newPilotName(); S.pilots.push({ name, fatigue: 0 }); log(`${name} has qualified and joined the spare pilot pool.`, 'good'); }
    S.training = null;
    startTasks();
  }
}
