// ---------- Tutorial: step-by-step coach with highlighted controls ----------
const tutActive = () => !!(S && S.tut);
const hasOwnFlight = () => S.flights.some(f => !isSupport(f));
const TUT = [
  { text: 'Welcome to the ops desk. Out the window is runway 27 and the ramp with your jets. Down here is your terminal, where you run the base. Time is paused while you read.', next: true },
  { text: 'Open the <b>Flightline</b> tab. It lists every aircraft with its fuel, damage, pilot fatigue and weapons.', sel: '[data-act=tab][data-tab=flightline]', done: () => UI.tab === 'flightline' },
  { text: 'Viper 1-3 has low fuel and no weapons. Press <b>Turnaround</b> on its card. Turnaround queues everything a jet needs in one go: repair if damaged, refuel to 100%, and re-arm with its weapons load.', sel: '[data-act=turn][data-id=V13]',
    done: () => { const a = AC('V13'); return !a || a.task || a.queue.length || a.status !== 'ready' || (a.fuel > 99 && a.load.aim120 > 0); } },
  { text: 'Ground crews do the work, three at a time. Extra jobs wait in line. Now let time run: press <b>1×</b>. Watch the fuel truck drive up to the jet in the window.', sel: '[data-act=speed][data-v="1"]', done: () => S.speed > 0 },
  { text: 'Operations earn your budget. Open the <b>Tasking</b> tab.', sel: '[data-act=tab][data-tab=missions]', done: () => UI.tab === 'missions' },
  { text: 'This is a combat air patrol. Select <b>Viper 1-1</b> and <b>Viper 1-2</b> to fly it. Greyed-out jets are not ready, and the reason is shown on them.', sel: '.pick', done: () => UI.pick.size >= 2 || hasOwnFlight() },
  { text: 'Tactics change how the flight fights: aggression, formation, rules of engagement and altitude. Each one shows what it does. The defaults are fine for now.', sel: '.tact', next: true },
  { text: 'Press <b>Launch</b>.', sel: '[data-act=launch]', done: hasOwnFlight },
  { text: 'Look out the window: your jets taxi to the runway and take off one after another. Landing aircraft always get the runway first.', next: true },
  { text: 'Open the <b>Tac map</b> to follow the flight.', sel: '[data-act=tab][data-tab=tac]', done: () => UI.tab === 'tac' },
  { text: 'On the right you can change tactics in the air, send a flight to the tanker for fuel, or call it home with <b>Order RTB</b>. Flights come home on their own when fuel gets low (bingo) or weapons run out (Winchester).', sel: '#tacside', next: true },
  { text: 'Open the <b>Supply</b> tab.', sel: '[data-act=tab][data-tab=supply]', done: () => UI.tab === 'supply' },
  { text: 'Every refuel and re-arm takes from these stores. Order more before they run out. Deliveries take a few hours and arrive by C-130 on your runway.', sel: '.res', next: true },
  { text: 'Open the <b>Base</b> tab.', sel: '[data-act=tab][data-tab=base]', done: () => UI.tab === 'base' },
  { text: 'Here you build hangars and air defences, train ground crews and pilots, and buy new aircraft. Locked items show the rank that unlocks them.', next: true },
  { text: 'Open the <b>Career</b> tab.', sel: '[data-act=tab][data-tab=career]', done: () => UI.tab === 'career', campaign: true },
  { text: 'Each shift has three objectives. They are also pinned on the clipboard next to the terminal on larger screens. Meet them before the shift ends to earn XP and bonus budget, and get promoted to unlock more.', sel: '.objs', next: true, campaign: true },
  { text: 'One last thing: when the radar reports hostile contacts, an alarm sounds. Launch an <b>Intercept</b> quickly, or the raid hits the base. That is the job. Good luck!', next: true, last: true },
];
function tutSkipInvalid() {
  while (S.tut && TUT[S.tut.i] && TUT[S.tut.i].campaign && !isCampaign()) S.tut.i++;
  if (S.tut && S.tut.i >= TUT.length) tutEnd();
}
function tutStart() { S.tut = { i: 0 }; S.speed = 0; UI.tutScrolled = -1; tutSkipInvalid(); }
function tutEnd() { S.tut = null; try { localStorage.setItem('kfo-tutorial-done', '1'); } catch (e) { /* ignore */ } }
function tutAdvance() { if (!S.tut) return; S.tut.i++; tutSkipInvalid(); }
function tutTick() {
  if (!S.tut) return;
  const st = TUT[S.tut.i];
  if (st && st.done && st.done()) tutAdvance();
}
function coachHTML() {
  if (!S.tut || !S.started || S.over || S.debrief) return '';
  const st = TUT[S.tut.i]; if (!st) return '';
  const total = TUT.filter(t => isCampaign() || !t.campaign).length;
  const n = TUT.slice(0, S.tut.i + 1).filter(t => isCampaign() || !t.campaign).length;
  return `<div class="coach-n">Tutorial ${n}/${total}</div><p>${st.text}</p><div class="acts">${st.next
    ? `<button class="btn go" data-act="tutnext">${st.last ? 'Finish' : 'Next'}</button>`
    : '<span class="muted">Do this to continue.</span>'}<button class="btn" data-act="tutskip">Skip tutorial</button></div>`;
}
function applyCoach() {
  document.querySelectorAll('.coach-hl').forEach(e => e.classList.remove('coach-hl'));
  if (!S.tut || !S.started || S.debrief) return;
  const st = TUT[S.tut.i]; if (!st || !st.sel) return;
  const el = document.querySelector(st.sel); if (!el) return;
  el.classList.add('coach-hl');
  if (UI.tutScrolled !== S.tut.i) { UI.tutScrolled = S.tut.i; try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* ignore */ } }
}
