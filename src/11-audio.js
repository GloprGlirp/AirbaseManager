// ---------- Sound: synthesized with Web Audio, heard through the office window ----------
const SND = { ctx: null, on: true, L: null, radioBusy: 0 };
try { SND.on = localStorage.getItem('kfo-sound') !== 'off'; } catch (e) { /* default on */ }

function audioInit() {
  if (!SND.on) return;
  if (SND.ctx) { if (SND.ctx.state === 'suspended') SND.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try {
    const c = new AC(); SND.ctx = c;
    const master = c.createGain(); master.gain.value = 0.85; master.connect(c.destination); SND.master = master;
    const mkBuf = brown => {
      const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
      return b;
    };
    SND.white = mkBuf(false); SND.brown = mkBuf(true);
    const loop = b => { const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.start(); return s; };
    const gain = v => { const g = c.createGain(); g.gain.value = v; return g; };
    const filt = (type, f, q = 0.7) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
    const pan = c.createStereoPanner ? c.createStereoPanner() : null; if (pan) pan.connect(master);
    const out = pan || master;
    // jet roar: rumble plus hiss, muffled by the glass
    const roarG = gain(0), roarF = filt('lowpass', 700);
    loop(SND.brown).connect(roarF); const hiss = gain(0.22); loop(SND.white).connect(hiss); hiss.connect(roarF);
    roarF.connect(roarG); roarG.connect(out);
    // turbine whine while taxiing
    const whG = gain(0), o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 960; o2.type = 'triangle'; o2.frequency.value = 1420;
    o1.connect(whG); o2.connect(whG); whG.connect(out); o1.start(); o2.start();
    // C-130 propellers: buzzy saws with a slow beat
    const prG = gain(0), prF = filt('lowpass', 420), p1 = c.createOscillator(), p2 = c.createOscillator();
    p1.type = 'sawtooth'; p1.frequency.value = 74; p2.type = 'sawtooth'; p2.frequency.value = 75.6;
    p1.connect(prF); p2.connect(prF); prF.connect(prG); prG.connect(out); p1.start(); p2.start();
    // rain on the glass, and the room itself
    const rnG = gain(0), rnF = filt('highpass', 1100); loop(SND.white).connect(rnF); rnF.connect(rnG); rnG.connect(master);
    const roomG = gain(0.04), roomF = filt('lowpass', 150); loop(SND.brown).connect(roomF); roomF.connect(roomG); roomG.connect(master);
    SND.L = { roarG, roarF, whG, o1, prG, rnG, roomG, pan };
    document.addEventListener('visibilitychange', () => { if (!SND.ctx) return; if (document.hidden) SND.ctx.suspend(); else if (SND.on) SND.ctx.resume(); });
  } catch (e) { SND.ctx = null; }
}
function setSound(on) {
  SND.on = on;
  try { localStorage.setItem('kfo-sound', on ? 'on' : 'off'); } catch (e) { /* ignore */ }
  if (on) audioInit();
  if (SND.ctx) SND.master.gain.setTargetAtTime(on ? 0.85 : 0, SND.ctx.currentTime, 0.05);
}
const ready = () => SND.ctx && SND.on && SND.ctx.state === 'running';
function setG(g, v, tc = 0.25) { g.gain.setTargetAtTime(v, SND.ctx.currentTime, tc); }

// Continuous layers follow what is happening on the runway
function audioFrame() {
  if (!SND.ctx || !SND.L || !S) return;
  const L = SND.L, live = SND.on && S.started && !S.over && S.speed > 0 ? 1 : 0;
  let roar = 0, idle = 0, prop = 0, px = 0.5;
  const consider = o => {
    const ph = o.phase; if (!ph || ph === 'inbound' || ph === 'unload' || (ph === 'taxi' && o.phT <= 0)) return;
    let r = 0, i = 0;
    if (ph === 'roll') { const t = o.phT / DEP.roll; r = t < 0.2 ? 0.3 : 0.5 + 0.5 * t; }
    else if (ph === 'climb') r = 1 - (o.phT / DEP.climb) * 0.85;
    else if (ph === 'final') r = 0.15 + 0.3 * (o.phT / ARR.final);
    else if (ph === 'rollout') r = 0.65 * (1 - o.phT / ARR.rollout) + 0.1;
    else i = 0.4;
    if (o.type === 'C-130H') prop = Math.max(prop, r || i);
    else {
      if (r > roar) { roar = r; const p = pose(o); px = p ? p.x : 0.5; }
      idle = Math.min(1, idle + i * 0.6);
    }
  };
  S.fleet.forEach(consider); S.cargo.forEach(consider);
  setG(L.roarG, roar * 0.6 * live, 0.15);
  L.roarF.frequency.setTargetAtTime(420 + roar * 1100, SND.ctx.currentTime, 0.2);
  if (L.pan) L.pan.pan.setTargetAtTime(clamp(px * 2 - 1, -1, 1) * 0.8, SND.ctx.currentTime, 0.2);
  setG(L.whG, (idle * 0.02 + roar * 0.012) * live, 0.3);
  L.o1.frequency.setTargetAtTime(900 + roar * 500 + idle * 80, SND.ctx.currentTime, 0.4);
  setG(L.prG, prop * 0.09 * live, 0.3);
  setG(L.rnG, ({ rain: 0.05, storm: 0.09 }[S.wx.kind] || 0) * (S.started ? 1 : 0), 1);
  setG(L.roomG, 0.04, 1);
}

// One-shot effects
function shot(dur, type, freq, q, peak, at = 0, buf = SND.white) {
  const c = SND.ctx, t = c.currentTime + at, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(SND.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  return f;
}
function tone(type, freq, dur, peak, at = 0, dest = SND.master) {
  const c = SND.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  return o;
}
function sfxClick() { if (ready()) tone('sine', 1750, 0.035, 0.02); }
function sfxRadio(msg) {
  if (!ready()) return;
  const c = SND.ctx, now = c.currentTime; if (now < SND.radioBusy) return;
  const syl = clamp(Math.round(msg.length / 9), 3, 11), dur = syl * 0.085;
  shot(0.07, 'bandpass', 2300, 1.4, 0.05);
  const band = c.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 1350; band.Q.value = 1.3;
  const bg = c.createGain(); bg.gain.value = 0.6; band.connect(bg); bg.connect(SND.master);
  const base = rnd(150, 230);
  for (let i = 0; i < syl; i++) {
    const o = tone('square', base * rnd(0.85, 1.35), 0.075, 0.035, 0.07 + i * 0.085, band);
    o.frequency.linearRampToValueAtTime(base * rnd(0.8, 1.2), c.currentTime + 0.07 + i * 0.085 + 0.07);
  }
  shot(dur + 0.08, 'bandpass', 1800, 0.8, 0.012, 0.06);
  shot(0.05, 'highpass', 3000, 0.7, 0.04, 0.08 + dur);
  SND.radioBusy = now + 0.1 + dur + 0.25;
}
function sfxAlarm() {
  if (!ready()) return;
  const lp = SND.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.connect(SND.master);
  for (let i = 0; i < 8; i++) tone('sawtooth', i % 2 ? 620 : 830, 0.34, 0.045, i * 0.36, lp);
}
function sfxBoom(delay = 0, size = 1) {
  if (!ready()) return;
  shot(3.2 * size, 'lowpass', 160, 0.7, 0.9 * size, delay, SND.brown);
  shot(0.7, 'lowpass', 900, 0.7, 0.35 * size, delay);
  const o = tone('sine', 58, 1.4 * size, 0.4 * size, delay); o.frequency.exponentialRampToValueAtTime(28, SND.ctx.currentTime + delay + 1.2);
}
function sfxThunder() { if (ready()) sfxBoom(rnd(0.3, 1.4), 0.7); }
function sfxLaunch() {
  if (!ready()) return;
  const f = shot(1.6, 'bandpass', 380, 1.2, 0.16);
  f.frequency.exponentialRampToValueAtTime(1500, SND.ctx.currentTime + 1.2);
  shot(0.4, 'lowpass', 300, 0.7, 0.3, 0, SND.brown);
}
function sfxChime() { if (ready()) { tone('triangle', 880, 0.25, 0.03); tone('triangle', 1320, 0.35, 0.03, 0.12); } }
function onLogHook(cls, msg) {
  if (!ready()) return;
  if (cls === 'radio') { if (/^(Patriot|Avenger):/.test(msg)) sfxLaunch(); sfxRadio(msg); }
  else if (cls === 'crit') { if (/^RADAR/.test(msg)) sfxAlarm(); else if (/^AIR RAID/.test(msg)) { sfxBoom(0, 1); sfxBoom(0.5, 0.8); sfxBoom(1.1, 0.9); } else tone('square', 300, 0.18, 0.025); }
  else if (cls === 'good') sfxChime();
}
