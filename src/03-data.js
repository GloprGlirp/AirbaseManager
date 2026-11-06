'use strict';
const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;

const SPEEDS = [0, 0.5, 1, 2, 4];            // game minutes per real second
const SPEED_LBL = ['Pause', '1×', '2×', '4×', '8×'];
const CREWS = 3;                             // ground crews working at once
const DEP = { taxi: 5, roll: 1.8, climb: 2.4 };
const ARR = { final: 2.6, rollout: 1.8, taxiin: 5 };
const REPLACE_COST = 1800, REPLACE_ETA = 360;

const RES_DEF = {
  fuel:   { name: 'JP-8 jet fuel',      short: 'JP-8',    note: 'Bulk storage, fuel farm',     u: 'kL',  cap: 600,   pack: 100,  cost: 90,  eta: 120 },
  aim120: { name: 'AIM-120C AMRAAM',    short: 'AIM-120', note: 'Radar-guided, long range',    u: '×',   cap: 40,    pack: 4,    cost: 360, eta: 180 },
  aim9:   { name: 'AIM-9X Sidewinder',  short: 'AIM-9X',  note: 'Infrared, short range',       u: '×',   cap: 40,    pack: 4,    cost: 150, eta: 150 },
  agm65:  { name: 'AGM-65 Maverick',    short: 'AGM-65',  note: 'Guided air-to-ground missile',u: '×',   cap: 24,    pack: 4,    cost: 200, eta: 180 },
  gbu12:  { name: 'GBU-12 Paveway II',  short: 'GBU-12',  note: 'Laser-guided 500 lb bomb',    u: '×',   cap: 32,    pack: 4,    cost: 110, eta: 150 },
  gun:    { name: '20mm PGU-28 rounds', short: '20mm',    note: 'M61A1 cannon ammunition',     u: 'rds', cap: 16000, pack: 2000, cost: 30,  eta: 90 },
  chaff:  { name: 'RR-170 chaff',       short: 'chaff',   note: 'Defeats radar missiles',      u: 'ctg', cap: 1600,  pack: 240,  cost: 25,  eta: 90 },
  flare:  { name: 'MJU-7 flares',       short: 'flares',  note: 'Defeats heat seekers',        u: 'ctg', cap: 1600,  pack: 240,  cost: 30,  eta: 90 },
  parts:  { name: 'Spare parts kits',   short: 'parts',   note: 'Repairs, runway crater fill', u: 'kits',cap: 50,    pack: 6,    cost: 120, eta: 120 },
  pac3:   { name: 'PAC-3 MSE interceptors', short: 'PAC-3', note: 'Patriot battery missiles',   u: '×',   cap: 8,     pack: 4,    cost: 400, eta: 240 },
  stinger:{ name: 'FIM-92 Stinger',     short: 'Stinger', note: 'Avenger SHORAD missiles',     u: '×',   cap: 12,    pack: 6,    cost: 90,  eta: 120 },
};
// Storage grows with base upgrades; air-defence missiles need their launchers first.
function capOf(k) {
  const R = RES_DEF[k], b = S.base;
  if (k === 'fuel') return R.cap + 250 * b.fuelfarm;
  if (k === 'pac3') return R.cap * b.patriot;
  if (k === 'stinger') return R.cap * b.shorad;
  if (k === 'parts') return R.cap;
  return Math.round(R.cap * (1 + 0.5 * b.bunker));
}
const RES_KEYS = Object.keys(RES_DEF);
const WKEYS = ['aim120', 'aim9', 'agm65', 'gbu12', 'gun', 'chaff', 'flare'];
const WLBL = { aim120: 'AIM-120', aim9: 'AIM-9X', agm65: 'AGM-65', gbu12: 'GBU-12', gun: '20mm', chaff: 'Chaff', flare: 'Flare' };
function fmtQ(k, q) {
  q = Math.floor(q);
  const u = RES_DEF[k].u;
  return u === '×' ? `${q}×` : `${q.toLocaleString('en-US')} ${u}`;
}

const TYPES = {
  'F-16C': { fuelKL: 4.5, speed: 15, burn: 1.15, size: 1, price: 2600, call: 'Viper', grp: 1, role: 'Multirole fighter. Cheap and quick to turn around.', loadouts: {
    A2A:    { aim120: 4, aim9: 2, gun: 510, chaff: 60, flare: 60 },
    CAP:    { aim120: 2, aim9: 2, gun: 510, chaff: 60, flare: 60 },
    STRIKE: { aim120: 2, agm65: 2, gbu12: 2, gun: 510, chaff: 60, flare: 60 } } },
  'F-15E': { fuelKL: 10, speed: 15.5, burn: 1.0, size: 1.22, twin: true, price: 3400, call: 'Razor', grp: 2, role: 'Heavy strike fighter. Long legs and a big bomb load.', loadouts: {
    A2A:    { aim120: 4, aim9: 4, gun: 500, chaff: 60, flare: 60 },
    CAP:    { aim120: 2, aim9: 2, gun: 500, chaff: 60, flare: 60 },
    STRIKE: { aim120: 2, aim9: 2, agm65: 2, gbu12: 4, gun: 500, chaff: 60, flare: 60 } } },
  'KC-135R': { fuelKL: 90, speed: 13, burn: 0.55, size: 2.1, tanker: true, price: 2800, call: 'Texaco', grp: 3, role: 'Aerial tanker. Gives airborne flights 40 kL of fuel.', loadouts: {} },
  'F/A-18E': { fuelKL: 6.5, speed: 14.5, burn: 1.05, size: 1.12, price: 3000, call: 'Rhino', grp: 4, role: 'Super Hornet. Rugged all-rounder with good endurance.', loadouts: {
    A2A:    { aim120: 4, aim9: 2, gun: 412, chaff: 60, flare: 60 },
    CAP:    { aim120: 2, aim9: 2, gun: 412, chaff: 60, flare: 60 },
    STRIKE: { aim120: 2, agm65: 2, gbu12: 4, gun: 412, chaff: 60, flare: 60 } } },
  'A-10C': { fuelKL: 4.9, speed: 9.5, burn: 0.7, size: 1.1, armor: 0.6, gunStrike: true, price: 2200, call: 'Hawg', grp: 5, role: 'Close air support. Slow and armoured, the 30mm gun counts on strikes. No radar missiles.', loadouts: {
    STRIKE: { aim9: 2, agm65: 4, gbu12: 4, gun: 1150, chaff: 120, flare: 120 },
    CAP:    { aim9: 2, agm65: 2, gun: 1150, chaff: 120, flare: 120 } } },
  'F-35A': { fuelKL: 8.3, speed: 15, burn: 0.95, size: 1.05, stealth: true, price: 4600, call: 'Ghost', grp: 6, role: 'Stealth fighter. Enemy fighters and SAMs struggle to hit it. Small internal bays.', loadouts: {
    A2A:    { aim120: 4, gun: 180, chaff: 40, flare: 40 },
    CAP:    { aim120: 2, gun: 180, chaff: 40, flare: 40 },
    STRIKE: { aim120: 2, gbu12: 2, gun: 180, chaff: 40, flare: 40 } } },
  'E-3G': { fuelKL: 70, speed: 12, burn: 0.5, size: 2.2, awacs: true, price: 4000, call: 'Sentry', grp: 7, role: 'AWACS radar plane. While on station every flight shoots better and spots raids sooner.', loadouts: {} },
  'C-130H':  { size: 1.8 },
};
const SHOP = ['F-16C', 'F-15E', 'F/A-18E', 'A-10C', 'F-35A', 'KC-135R', 'E-3G'];
const isSupportType = t => !!(TYPES[t].tanker || TYPES[t].awacs);
const defaultLoadout = t => { const k = Object.keys(TYPES[t].loadouts || {}); return k.includes('A2A') ? 'A2A' : k[0] || null; };
const replaceCost = a => Math.round((TYPES[a.type].price || 2600) * 0.7 / 10) * 10;

// Base development
const UPGRADES = {
  hangar:   { name: 'Aircraft hangar', note: 'Room for 2 more aircraft. Jets inside are safe from raids.', cost: 900, time: 360, max: 4 },
  rrr:      { name: 'Runway repair team', note: 'Craters are filled about twice as fast after a raid, and emergency repairs cost 30% less.', cost: 450, time: 150, max: 2 },
  patriot:  { name: 'Patriot SAM battery', note: 'Shoots down raiders out to 80 km. Needs PAC-3 interceptors.', cost: 1400, time: 480, max: 2 },
  shorad:   { name: 'Avenger SHORAD', note: 'Stinger launchers that cover the base itself.', cost: 450, time: 180, max: 3 },
  fuelfarm: { name: 'Fuel farm expansion', note: '+250 kL jet fuel storage.', cost: 500, time: 240, max: 2 },
  bunker:   { name: 'Munitions bunker', note: '+50% storage for missiles, bombs, ammo and countermeasures.', cost: 600, time: 300, max: 2 },
  quarters: { name: 'Crew quarters', note: 'Pilots recover from fatigue twice as fast.', cost: 350, time: 240, max: 1 },
};
// Perks: automation and crew bonuses, unlocked with perk points in the campaign
const PERKS = {
  autofuel:   { name: 'Auto refuel', note: 'Crews refuel every parked jet below 95% without being asked.', cost: 1 },
  autorepair: { name: 'Auto repair', note: 'Damaged jets go to the repair crews as soon as they park.', cost: 1 },
  autoarm:    { name: 'Auto re-arm', note: 'Jets are reloaded with their last weapons load after every sortie.', cost: 2 },
  fastcrew:   { name: 'Fast crews', note: 'Refuelling, arming and repairs take 25% less time.', cost: 2 },
  autosupply: { name: 'Auto resupply', note: 'Orders fuel and munitions when stock drops below a quarter, keeping $300K in reserve.', cost: 2 },
};
const perkOn = k => !!(S && S.perks && S.perks[k] === 'on');
const allPerksOff = () => Object.fromEntries(Object.keys(PERKS).map(k => [k, 'off']));
const CREW_COST = 220, CREW_TIME = 240, CREW_MAX = 8;
const PILOT_COST = 300, PILOT_TIME = 360, PILOT_MAX = 4;
const RANKS = ['Capt.', '1st Lt.', 'Maj.', 'Capt.', '1st Lt.'];
const SURNAMES = ['Brandt', 'Okafor', 'Nakamura', 'Reyes', 'Holm', 'Petrov', 'Adeyemi', 'Calloway', 'Sato', 'Dubois', 'Kowalski', 'Mercer', 'Ibarra', 'Lindgren', 'Vance', 'Achterberg', 'Haddad', 'Novak'];
const newPilotName = () => `${pick(RANKS)} ${String.fromCharCode(65 + irnd(0, 25))}. ${pick(SURNAMES)}`;

// Parking: 7 ramp spots in view, then 2 slots inside each hangar on the far side of the runway
const RAMP_BIG = 6;
const HANGAR_SITES = [0.02, 0.145, 0.27, 0.635], HANGAR_W = 0.11;
function slotInfo(slot) {
  if (slot < SPOTS.length) return { x: SPOTS[slot], hangar: false };
  const i = slot - SPOTS.length, h = Math.floor(i / 2);
  return { x: HANGAR_SITES[h] + HANGAR_W * (i % 2 ? 0.72 : 0.28), hangar: true, h };
}
const slotLabel = s => s < SPOTS.length ? `on spot ${pad2(s + 1)}` : `in hangar H${Math.floor((s - SPOTS.length) / 2) + 1}`;
function slotCount() { return SPOTS.length + 2 * S.base.hangar; }
function freeSlot(type) {
  const big = (TYPES[type].size || 1) >= 2, used = new Set(S.fleet.map(a => a.slot));
  const order = [];
  for (let s = 0; s < SPOTS.length; s++) if (s !== RAMP_BIG && !big) order.push(s);
  if (big) order.push(RAMP_BIG);
  for (let s = SPOTS.length; s < slotCount(); s++) order.push(s);
  if (!big) order.push(RAMP_BIG);
  return order.find(s => !used.has(s)) ?? -1;
}
const LO_NAME = { A2A: 'Air superiority', CAP: 'Light CAP', STRIKE: 'Strike' };

const TAC_OPTS = {
  aggr: { label: 'Aggression', opts: [['DEF', 'Defensive'], ['BAL', 'Balanced'], ['AGG', 'Aggressive']] },
  form: { label: 'Formation', opts: [['WEDGE', 'Wedge'], ['LINE', 'Line abreast'], ['TRAIL', 'Trail']] },
  roe:  { label: 'Rules of engagement', opts: [['HOLD', 'Hold'], ['TIGHT', 'Tight'], ['FREE', 'Free']] },
  alt:  { label: 'Altitude', opts: [['LOW', 'Low'], ['MED', 'Medium'], ['HIGH', 'High']] },
};
const TAC_HELP = {
  aggr: { DEF: 'Fewer shots, harder to hit.', BAL: 'Standard engagement.', AGG: 'More shots and kills, more exposure.' },
  form: { WEDGE: 'Balanced mutual support.', LINE: 'Wider radar picture, earlier and better first shots.', TRAIL: 'Safest, but slower to kill.' },
  roe:  { HOLD: 'Fire only in self-defence. Nearly no kills.', TIGHT: 'Fire on identified hostiles.', FREE: 'Fire early and often. Burns missiles.' },
  alt:  { LOW: 'Accurate bombing, heavy fuel burn, no long-range shots.', MED: 'Standard profile.', HIGH: 'Best fuel and missile range, poorer bombing.' },
};
const DEFAULT_TAC = { aggr: 'BAL', form: 'WEDGE', roe: 'TIGHT', alt: 'MED' };

const SPOTS = [0.07, 0.155, 0.24, 0.325, 0.43, 0.545, 0.70];
const CARGO_SPOT = 0.875;
const FLEET_DEF = [
  ['V11', 'Viper 1-1', 'F-16C', '90-0712', 'Maj. D. Kessler'],
  ['V12', 'Viper 1-2', 'F-16C', '90-0745', 'Capt. A. Moreno'],
  ['V13', 'Viper 1-3', 'F-16C', '91-0388', '1st Lt. S. Park'],
  ['V14', 'Viper 1-4', 'F-16C', '91-0402', 'Capt. L. Varga'],
  ['R21', 'Razor 2-1', 'F-15E', '88-1690', 'Lt. Col. M. Osei'],
  ['R22', 'Razor 2-2', 'F-15E', '89-0487', 'Capt. J. Lindqvist'],
  ['T31', 'Texaco 3-1', 'KC-135R', '62-3551', 'Maj. P. Duarte'],
];
const OPS = ['GRANITE','HALBERD','COPPER','NIGHTJAR','SALTMARSH','IRONWOOD','BRAMBLE','TINDER','SHALE','HARROW','LANTERN','GALLOWAY','RIMFROST','OXBOW','SPARROWHAWK','CINDER','FELDSPAR','WAYPOST','THISTLE','MERIDIAN','HOLLOWAY','BASALT'];
const TARGETS = ['a radar site','a fuel depot','a rail bridge','an air-defence command post','a supply convoy','a forward airstrip','an ammunition dump','a SAM battery'];
const RECON = ['a coastal harbour','a river crossing','a suspected missile site','a mountain pass','an airfield under construction'];

function mkLoad(type, lo) {
  const L = {};
  WKEYS.forEach(k => L[k] = 0);
  if (lo && TYPES[type].loadouts[lo]) Object.assign(L, TYPES[type].loadouts[lo]);
  return L;
}
function newFleet() {
  return FLEET_DEF.map((r, i) => {
    const [id, call, type, tail, pilot] = r;
    const lo = TYPES[type].tanker ? null : (type === 'F-15E' ? 'STRIKE' : 'A2A');
    const a = { id, call, type, tail, pilot, slot: i, status: 'ready', phase: null, phT: 0,
      task: null, queue: [], fuel: 100, cond: 100, fatigue: irnd(0, 14), loadout: lo, load: mkLoad(type, lo), flight: null, replacing: null };
    if (id === 'V13') { a.fuel = 42; a.loadout = null; a.load = mkLoad(type, null); }
    if (id === 'V14') a.cond = 66;
    return a;
  });
}
function newGame(mode = 'free') {
  return { v: 2, mode, xp: 0, shiftsDone: 0, stars: 0, shift: null, debrief: null, perks: mode === 'free' ? allPerksOff() : {}, perkPts: 0, perkRankPaid: 0,
    t: mode === 'campaign' ? 6 * 60 : 6 * 60 + 40, funds: 2400, rep: 60, speed: 1, started: false, over: false,
    crews: 3, base: { hangar: 0, rrr: 0, patriot: 0, shorad: 0, fuelfarm: 0, bunker: 0, quarters: 0 }, build: null, training: null, pilots: [],
    res: { fuel: 360, aim120: 14, aim9: 18, agm65: 8, gbu12: 10, gun: 6000, chaff: 520, flare: 480, parts: 16, pac3: 0, stinger: 0 },
    fleet: newFleet(), missions: [], flights: [], raids: [], deliveries: [], cargo: [], fx: [],
    runway: { busy: null, closedUntil: 0 }, log: [], nextId: 1, nextMission: 6 * 60 + 43, budgetDay: 0,
    wx: { kind: 'clear', wind: 270, kt: 7, until: 6 * 60 + 220 },
    stats: { won: 0, failed: 0, kills: 0, lost: 0, sorties: 0 } };
}

let S = null;
const AC = id => S.fleet.find(a => a.id === id);
const MS = id => S.missions.find(m => m.id === id);
const FL = id => S.flights.find(f => f.id === id);
const pad2 = n => String(n).padStart(2, '0');
function fmtClock(t) { const m = Math.floor(t % 1440); return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`; }
function fmtT(t) { return `D${Math.floor(t / 1440) + 1} ${fmtClock(t)}`; }
function fmtDur(m) { m = Math.max(0, Math.ceil(m)); return m >= 60 ? `${Math.floor(m / 60)}h ${pad2(m % 60)}m` : `${m} min`; }
function money(k) { return Math.abs(k) >= 1000 ? `$${(k / 1000).toFixed(2)}M` : `$${Math.round(k)}K`; }
function hourOf(t) { return (t % 1440) / 60; }
function log(msg, cls = '') {
  S.log.push({ t: S.t, msg, cls }); if (S.log.length > 240) S.log.splice(0, S.log.length - 240);
  if (typeof onLogHook === 'function') onLogHook(cls, msg);
}
const radio = m => log(m, 'radio');
function bearingName(x, y) { const a = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360; return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(a / 45) % 8]; }
function sectorName(x, y) { return `${bearingName(x, y)}-${Math.max(1, Math.round(hyp(x, y) / 40))}`; }
const SAVE_KEY = 'kestrel-field-ops-v1';
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
function loadGame() {
  try { const s = localStorage.getItem(SAVE_KEY); if (s) { const o = JSON.parse(s); if (o && (o.v === 1 || o.v === 2) && o.fleet) return migrate(o); } } catch (e) { /* ignore */ }
  return null;
}
function migrate(o) {
  if (o.v === 1) {
    Object.assign(o, { v: 2, crews: 3, base: { hangar: 0, patriot: 0, shorad: 0, fuelfarm: 0, bunker: 0, quarters: 0 }, build: null, training: null, pilots: [] });
    o.res.pac3 = 0; o.res.stinger = 0;
    o.fleet.forEach((a, i) => { a.slot = SPOTS.includes(a.spot) ? SPOTS.indexOf(a.spot) : i; delete a.spot; });
  }
  if (!o.mode) Object.assign(o, { mode: 'free', xp: 0, shiftsDone: 0, stars: 0, shift: null, debrief: null });
  if (o.base && o.base.rrr == null) o.base.rrr = 0;
  if (!o.perks) { o.perks = o.mode === 'free' ? allPerksOff() : {}; o.perkPts = 0; }
  return o;
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
