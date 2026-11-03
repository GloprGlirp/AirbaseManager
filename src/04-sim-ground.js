// ---------- Ground crews: refuel, arm, repair ----------
function crewsBusy() { return S.fleet.filter(a => a.task).length; }
function needsArm(a, lo) {
  const L = TYPES[a.type].loadouts[lo]; if (!L) return false;
  return WKEYS.some(k => (L[k] || 0) !== (a.load[k] || 0));
}
function queueTask(a, kind, arg) {
  if (!a || a.status !== 'ready') return;
  if (a.queue.some(q => q.kind === kind) || (a.task && a.task.kind === kind && kind !== 'arm')) return;
  a.queue.push({ kind, arg });
  startTasks();
}
function turnaround(a) {
  if (!a || a.status !== 'ready') return;
  if (a.cond < 99.5) queueTask(a, 'repair');
  if (a.fuel < 99.5) queueTask(a, 'refuel');
  const lo = a.loadout || defaultLoadout(a.type);
  if (lo && needsArm(a, lo)) queueTask(a, 'arm', lo);
}
function startTasks() {
  for (const a of S.fleet) {
    if (crewsBusy() >= S.crews) return;
    if (a.status !== 'ready' || a.task) continue;
    while (a.queue.length && !a.task) beginTask(a, a.queue.shift());
  }
}
function beginTask(a, q) {
  const T = TYPES[a.type];
  if (q.kind === 'refuel') {
    const need = (100 - a.fuel) / 100 * T.fuelKL; if (need < 0.05) return;
    const got = Math.min(need, S.res.fuel);
    if (got < 0.05) { log(`${a.call}: refuel cancelled, the fuel farm is empty.`, 'warn'); return; }
    S.res.fuel -= got;
    a.task = { kind: 'refuel', t: 0, dur: T.tanker ? 16 : 6, fuelTo: Math.min(100, a.fuel + got / T.fuelKL * 100) };
    if (got < need - 0.05) log(`${a.call}: partial refuel, the fuel farm ran dry.`, 'warn');
  } else if (q.kind === 'arm') {
    const L = T.loadouts[q.arg]; if (!L) return;
    const add = {}; let short = false;
    for (const k of WKEYS) {
      const want = L[k] || 0, have = a.load[k] || 0;
      if (have > want) { S.res[k] += have - want; a.load[k] = want; }
      else if (want > have) {
        const take = Math.min(want - have, Math.floor(S.res[k]));
        S.res[k] -= take; add[k] = take; if (take < want - have) short = true;
      }
    }
    a.loadout = q.arg;
    a.task = { kind: 'arm', t: 0, dur: q.arg === 'STRIKE' ? 12 : 8, add };
    if (short) log(`${a.call}: loaded short of the ${LO_NAME[q.arg]} configuration, stores are low.`, 'warn');
  } else if (q.kind === 'repair') {
    const dmg = 100 - a.cond; if (dmg < 0.5) return;
    const needP = Math.ceil(dmg / 15), p = Math.min(needP, S.res.parts);
    if (p <= 0) { log(`${a.call}: repair cancelled, no spare parts kits.`, 'warn'); return; }
    S.res.parts -= p;
    const fix = dmg * p / needP;
    a.task = { kind: 'repair', t: 0, dur: 6 + fix * 0.45, condTo: Math.min(100, a.cond + fix) };
  }
}
function tickTasks(dt) {
  for (const a of S.fleet) {
    const k = a.task; if (!k) continue;
    k.t += dt; if (k.t < k.dur) continue;
    if (k.kind === 'refuel') a.fuel = k.fuelTo;
    if (k.kind === 'arm') for (const w in k.add) a.load[w] += k.add[w];
    if (k.kind === 'repair') a.cond = k.condTo;
    a.task = null;
    if (!a.queue.length) log(`${a.call}: crew chief reports ${k.kind === 'arm' ? 'stores loaded' : k.kind === 'refuel' ? 'refuel complete' : 'repairs complete'}.`);
  }
  startTasks();
}

// ---------- Logistics ----------
function pending(k) {
  let n = 0;
  for (const d of S.deliveries) for (const [r, q] of d.items) if (r === k) n += q;
  for (const c of S.cargo) for (const [r, q] of c.items) if (r === k) n += q;
  return n;
}
function orderBlock(k) {
  const R = RES_DEF[k], cap = capOf(k);
  if (!cap) return k === 'pac3' ? 'Build a Patriot battery first' : 'Build an Avenger first';
  if (S.res[k] + pending(k) + R.pack > cap) return 'Storage full';
  if (S.funds < R.cost) return 'No budget';
  return null;
}
function order(k) {
  const R = RES_DEF[k]; if (orderBlock(k)) return;
  S.funds -= R.cost;
  const at = S.t + R.eta;
  const d = S.deliveries.find(d => Math.abs(d.at - at) <= 30);
  if (d) {
    const it = d.items.find(i => i[0] === k);
    if (it) it[1] += R.pack; else d.items.push([k, R.pack]);
    d.at = Math.max(d.at, at);
  } else S.deliveries.push({ id: S.nextId++, at, items: [[k, R.pack]] });
  log(`Ordered ${fmtQ(k, R.pack)} ${R.short} for ${money(R.cost)}. Airlift ETA ${fmtDur(R.eta)}.`);
}
function requestReplacement(a) {
  if (!a || a.status !== 'lost' || a.replacing || S.funds < replaceCost(a)) return;
  S.funds -= replaceCost(a);
  a.replacing = S.t + REPLACE_ETA;
  log(`Replacement ${a.type} requested for ${a.call}. Ferry flight in ${fmtDur(REPLACE_ETA)}.`);
}

// ---------- Launch ----------
function readiness(a) {
  if (!a) return 'Unknown';
  if (a.status === 'ordered') return 'On order';
  if (a.status === 'lost') return a.replacing ? 'Replacement en route' : 'Lost';
  if (a.status !== 'ready') return 'Not on the ramp';
  if (a.task || a.queue.length) return 'Being serviced';
  if (a.cond < 50) return 'Grounded, needs repair';
  if (a.fatigue > 80) return 'Crew rest required';
  if (a.fuel < 35) return 'Fuel too low';
  return null;
}
function tankerTrack(r = 70) {
  const act = S.missions.filter(m => m.status === 'open' || m.status === 'active');
  if (!act.length) return { x: 0, y: -r };
  let x = 0, y = 0; act.forEach(m => { x += m.x; y += m.y; });
  const d = hyp(x, y) || 1;
  return { x: x / d * r, y: y / d * r };
}
function launch(mid, ids, tac) {
  const m = mid ? MS(mid) : null;
  if (m && m.status !== 'open') return false;
  ids = ids.filter(id => !readiness(AC(id)));
  if (!ids.length) return false;
  const lead = AC(ids[0]);
  const f = { id: 'F' + (S.nextId++), mission: m ? m.id : null, kind: m ? m.type : (TYPES[lead.type].awacs ? 'AWACS' : 'TANKER'), members: ids.slice(),
    tac: { ...tac }, state: 'launch', x: 0, y: 0, hdg: -Math.PI / 2, stT: 0, trT: 0, trail: [], enemy: null,
    refT: 0, tanker: null, offload: 0, call: lead.call.replace(/-\d+$/, '') };
  ids.forEach((id, i) => { const a = AC(id); a.status = 'dep'; a.phase = 'taxi'; a.phT = -i * 1.4; a.flight = f.id; a.queue = []; });
  if (m) { m.status = 'active'; m.flight = f.id; }
  if (!m) { if (f.kind === 'TANKER') f.offload = 40; const t = tankerTrack(f.kind === 'AWACS' ? 55 : 70); f.tx = t.x; f.ty = t.y; }
  S.flights.push(f);
  S.stats.sorties += ids.length;
  radio(`${lead.call}: ${ids.length > 1 ? 'flight of ' + ids.length + ', ' : ''}taxiing${m ? ' for Op. ' + m.op : f.kind === 'AWACS' ? ' for the AWACS orbit' : ' to the tanker track'}.`);
  return true;
}

// ---------- Runway and ground movement ----------
function runwayFree() { return !S.runway.busy && S.t >= S.runway.closedUntil; }
function arrivalsWaiting() { return S.fleet.some(a => a.phase === 'inbound') || S.cargo.some(c => c.phase === 'inbound'); }
function advance(o, dt) {
  o.phT += dt;
  switch (o.phase) {
    case 'taxi': if (o.phT >= DEP.taxi) { o.phase = 'hold'; o.phT = 0; } break;
    case 'hold':
      if (runwayFree() && !arrivalsWaiting()) {
        S.runway.busy = o.id; o.phase = 'roll'; o.phT = 0;
        radio(`Tower: ${o.call}, wind ${S.wx.wind} at ${S.wx.kt}, runway 27, cleared for takeoff.`);
      } break;
    case 'roll': if (o.phT >= DEP.roll) { o.phase = 'climb'; o.phT = 0; S.runway.busy = null; } break;
    case 'climb': if (o.phT >= DEP.climb) { o.phase = null; return 'airborne'; } break;
    case 'inbound':
      if (runwayFree()) {
        S.runway.busy = o.id; o.phase = 'final'; o.phT = 0;
        radio(`Tower: ${o.call}, runway 27, cleared to land.`);
      } break;
    case 'final': if (o.phT >= ARR.final) { o.phase = 'rollout'; o.phT = 0; } break;
    case 'rollout': if (o.phT >= ARR.rollout) { o.phase = 'taxiin'; o.phT = 0; S.runway.busy = null; } break;
    case 'taxiin': if (o.phT >= ARR.taxiin) { o.phase = null; return 'parked'; } break;
    case 'unload': if (o.phT >= 12) { o.phase = 'taxi'; o.phT = 0; return 'unloaded'; } break;
  }
  return null;
}
function tickGround(dt) {
  for (const a of S.fleet) {
    if (a.status === 'dep') {
      if (advance(a, dt) === 'airborne') { a.status = 'air'; radio(`${a.call} airborne.`); }
    } else if (a.status === 'arr') {
      if (advance(a, dt) === 'parked') {
        a.status = 'ready'; a.flight = null;
        if (a.cond < 50) log(`${a.call} on the ramp with ${Math.round(100 - a.cond)}% damage. Grounded until repaired.`, 'warn');
        else log(`${a.call} shut down ${slotLabel(a.slot)}. Fuel ${Math.round(a.fuel)}%.`);
      }
    }
  }
  for (const c of S.cargo) {
    const r = advance(c, dt);
    if (r === 'parked') { c.phase = 'unload'; c.phT = 0; }
    if (r === 'unloaded') {
      const txt = c.items.map(([k, q]) => `${fmtQ(k, q)} ${RES_DEF[k].short}`).join(', ');
      for (const [k, q] of c.items) S.res[k] = Math.min(capOf(k), S.res[k] + q);
      c.items = [];
      log(`${c.call} unloaded: ${txt}.`, 'good');
    }
    if (r === 'airborne') c.gone = true;
  }
  S.cargo = S.cargo.filter(c => !c.gone);
  for (const d of S.deliveries) {
    if (S.t < d.at) continue;
    d.done = true;
    const c = S.cargo.find(c => ['inbound', 'final', 'rollout', 'taxiin'].includes(c.phase));
    if (c) c.items.push(...d.items.map(i => i.slice()));
    else {
      const call = `Herky ${irnd(21, 78)}`;
      S.cargo.push({ id: 'C' + (S.nextId++), call, type: 'C-130H', phase: 'inbound', phT: 0, items: d.items.map(i => i.slice()) });
      radio(`${call}: C-130 inbound with resupply, request landing.`);
    }
  }
  S.deliveries = S.deliveries.filter(d => !d.done);
}
