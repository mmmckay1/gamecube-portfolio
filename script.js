// ========== HELPERS ==========
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const activeScreen = () => document.querySelector('.screen.active').id;

// ========== CUBE BUILDER ==========
function makeCube(size = 60) {
  const cube = document.createElement('div');
  cube.className = 'cube';
  cube.style.setProperty('--s', size + 'px');
  for (const f of ['front', 'back', 'right', 'left', 'top', 'bottom']) {
    const face = document.createElement('div');
    face.className = 'face ' + f;
    cube.appendChild(face);
  }
  return cube;
}

// ========== SOUND ==========
let ctx, out; // created on first click/key (browsers require this); every sound goes through `out`
let muted = false;
try { muted = localStorage.getItem('muted') === '1'; } catch {}

function tone(freq, start, dur, type = 'sine', vol = 0.15) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  o.connect(g).connect(out);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur);
}
// Melody of "Giant Steps" (John Coltrane), one note per roll of the boot cube (15 rolls)
// (concert pitch; tied notes count once, so bars 1-9 give exactly 15 attacks)
const GIANT_STEPS = ['F#5', 'D5', 'B4', 'G4', 'Bb4', 'B4', 'A4', 'D5', 'Bb4', 'G4', 'Eb4', 'F#4',
                     'G4', 'F4', 'Bb4'];
const SEMI = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const hz = n => 440 * 2 ** ((SEMI[n.slice(0, -1)] + 12 * (+n.slice(-1) + 1) - 69) / 12);
const blip = i => tone(hz(GIANT_STEPS[(i - 1) % GIANT_STEPS.length]), 0, 0.16, 'triangle');
// G maj7 arpeggio, the chord the Giant Steps phrase resolves to
const chime = () => ['G4', 'B4', 'D5', 'F#5'].forEach((n, i) => tone(hz(n), i * 0.08, 1.5));

// ========== START ==========
let starting = false;
function wakeAudio() {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    out = ctx.createGain();
    out.gain.value = muted ? 0 : 1;
    out.connect(ctx.destination);
  }
  return ctx.resume();
}
async function begin() {
  if (starting) return; // ignore extra clicks/keys while audio wakes up
  starting = true;
  await wakeAudio();
  // resume() can resolve before sound is actually flowing, which swallows the first blips.
  // Wait until the audio clock has really moved on (~50ms of rendered audio), up to 1s.
  const t0 = ctx.currentTime, since = performance.now();
  while (ctx.currentTime < t0 + 0.05 && performance.now() - since < 1000) await wait(10);
  starting = false;
  boot();
}
// pointerdown fires before click, so the audio starts waking up a little sooner
document.getElementById('start').addEventListener('pointerdown', wakeAudio);
document.getElementById('start').addEventListener('click', begin);

// ========== MUTE ==========
const muteBtn = document.getElementById('mute');
function setMuted(m) {
  muted = m;
  if (out) out.gain.value = m ? 0 : 1;
  muteBtn.textContent = m ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
  muteBtn.setAttribute('aria-pressed', m);
  try { localStorage.setItem('muted', m ? '1' : '0'); } catch {}
}
setMuted(muted);
muteBtn.addEventListener('click', e => { e.stopPropagation(); setMuted(!muted); });

// ========== BOOT ANIMATION ==========
const CELL = 60;
// [column, row] squares on a 5x5 floor that trace an "M"
// (up the left leg, down into the middle V and back up, then down the right leg)
const PATH = [[0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[1,1],[2,1],[2,2],[2,1],[3,1],[3,0],
              [4,0],[4,1],[4,2],[4,3],[4,4]];
let skip = false;
document.getElementById('boot').addEventListener('click', () => skip = true);

function rollTo(pos, roll, from, to, duration = 180) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const [origin, rot] =
    dx ===  1 ? ['100% 50% 0', 'rotateY(90deg)']  :
    dx === -1 ? ['0% 50% 0',   'rotateY(-90deg)'] :
    dy ===  1 ? ['50% 100% 0', 'rotateX(-90deg)'] :
                ['50% 0% 0',   'rotateX(90deg)'];
  roll.style.transformOrigin = origin;
  return roll.animate([{ transform: 'none' }, { transform: rot }],
                      { duration, easing: 'ease-in' }).finished
    .then(() => { pos.style.transform = `translate(${to[0] * CELL}px, ${to[1] * CELL}px)`; });
}

// Hop (with a forward flip) onto the last square and carry straight on down through it.
// onImpact fires the moment the cube hits the floor.
function hopInto(pos, roll, from, to, onImpact) {
  const at = ([c, r], z = 0) => `translate(${c * CELL}px, ${r * CELL}px) translateZ(${z}px)`;
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const flip = dx ? `rotateY(${dx * 360}deg)` : `rotateX(${-dy * 360}deg)`;
  const duration = 650, impact = 0.75;
  roll.style.transformOrigin = '50% 50% 30px'; // spin around the cube's centre
  roll.animate([
    { transform: 'none', easing: 'ease-in-out' },
    { transform: flip, offset: impact },
    { transform: `${flip} scale(.5)` },
  ], { duration, fill: 'forwards' });
  // fade the faces, not the cube itself: opacity on a 3D container flattens it
  roll.querySelectorAll('.face').forEach(f => f.animate([{ opacity: 1 }, { opacity: 0 }],
    { duration: duration * (1 - impact), delay: duration * impact, fill: 'forwards' }));
  setTimeout(onImpact, duration * impact);
  return pos.animate([
    { transform: at(from),    easing: 'ease-out' },
    { transform: at(mid, 90), easing: 'ease-in', offset: 0.4 },
    { transform: at(to),      easing: 'linear',  offset: impact },
    { transform: at(to, -70) },
  ], { duration }).finished
    .then(() => pos.remove());
}

function addTile(plane, [c, r]) {
  const t = document.createElement('div');
  t.className = 'tile';
  t.style.left = c * CELL + 'px';
  t.style.top  = r * CELL + 'px';
  plane.appendChild(t);
  return t;
}

// Copy the finished M, then slide the original left and the copy right (both initials)
function splitM(plane) {
  const original = plane.querySelector('.m-group');
  const copy = original.cloneNode(true);
  plane.appendChild(copy);
  copy.getBoundingClientRect(); // commit the start state so the transition runs
  original.classList.add('left');
  copy.classList.add('right');
  document.querySelector('.stage').classList.add('split');
  tone(392, 0, 0.3, 'triangle', 0.1);
  tone(hz('D5'), 0.12, 0.4, 'triangle', 0.1);
}

async function boot() {
  show('boot');
  skip = false;
  const plane = document.getElementById('plane');
  plane.innerHTML = ''; // clear tiles from a previous run
  document.querySelector('.stage').classList.remove('split');
  const group = document.createElement('div'); group.className = 'm-group';
  plane.appendChild(group);
  document.querySelector('.logo').classList.remove('show');
  const pos = document.createElement('div');  pos.className = 'pos';
  const roll = document.createElement('div'); roll.className = 'roll';
  roll.appendChild(makeCube(60));
  pos.appendChild(roll);
  group.appendChild(pos);
  pos.style.transform = `translate(${PATH[0][0] * CELL}px, ${PATH[0][1] * CELL}px)`;

  const last = PATH.length - 1;
  for (let i = 1; i < last && !skip; i++) {
    addTile(group, PATH[i - 1]);
    blip(i);
    // ease off over the final few rolls
    await rollTo(pos, roll, PATH[i - 1], PATH[i], 180 + Math.max(0, i - (last - 4)) * 60);
  }

  if (!skip) {
    addTile(group, PATH[last - 1]);
    // the jump carries on with bar 10 of the tune: B held for the whole hop...
    tone(hz('B4'), 0, 0.49, 'triangle', 0.12);
    await hopInto(pos, roll, PATH[last - 1], PATH[last], () => {
      addTile(group, PATH[last]).classList.add('flash');
      // ...then A as it punches through
      tone(hz('A4'), 0, 0.3, 'triangle', 0.12);
    });
    await wait(300);
  }

  if (!skip) {
    splitM(plane);
    await wait(800);
  }

  if (!skip) {
    chime();
    document.querySelector('.logo').classList.add('show');
    for (let t = 0; t < 2500 && !skip; t += 100) await wait(100);
  }

  show('menu');
  select(0);
}

// ========== MAIN MENU ==========
const spin = document.getElementById('spin');
const big = makeCube(innerWidth < 600 ? 130 : 190);
spin.appendChild(big);
['top', 'right', 'bottom', 'left'].forEach((f, i) =>
  big.querySelector('.' + f).textContent = ['ABOUT', 'PROJECTS', 'CONTACT', 'RESUME'][i]);
big.querySelector('.front').textContent = 'MM'; // initials
big.querySelector('.back').textContent = '★';

// [rotateX, rotateY] that turns each option's face toward the viewer
const VIEWS = [[-90, 0], [0, -90], [90, 0], [0, 90]];
const opts = [...document.querySelectorAll('.opt')];
let sel = 0;

function select(i) {
  sel = (i + 4) % 4;
  const [x, y] = VIEWS[sel];
  spin.style.transform = `rotateX(-15deg) rotateY(20deg) rotateX(${x}deg) rotateY(${y}deg)`;
  opts.forEach((o, j) => o.classList.toggle('on', j === sel));
  tone(660, 0, 0.08, 'square', 0.05);
}

opts.forEach((o, i) => {
  o.addEventListener('mouseenter', () => { if (i !== sel) select(i); });
  o.addEventListener('click', () => { select(i); openPanel(i); });
});

// ========== PANELS ==========
let openIdx = null;

function openPanel(i) {
  openIdx = i;
  document.getElementById('panel-' + i).classList.add('open');
  document.getElementById('menu').classList.add('dim');
  chime();
}

function closePanel() {
  if (openIdx === null) return;
  document.getElementById('panel-' + openIdx).classList.remove('open');
  document.getElementById('menu').classList.remove('dim');
  openIdx = null;
  tone(440, 0, 0.1, 'triangle');
}

document.querySelectorAll('.panel .back').forEach(b => b.addEventListener('click', closePanel));

// ========== BACK TO START ==========
function goHome() {
  closePanel();
  show('start');
  tone(330, 0, 0.15, 'triangle');
}
document.getElementById('home').addEventListener('click', goHome);

// Memory card slot tabs (Slot A = projects, Slot B = game saves)
const slots = [...document.querySelectorAll('.slot')];
slots.forEach(t => t.addEventListener('click', () => {
  slots.forEach(o => {
    const on = o === t;
    o.classList.toggle('on', on);
    o.setAttribute('aria-selected', on);
    document.getElementById(o.dataset.slot).hidden = !on;
  });
  tone(t.dataset.slot === 'slot-a' ? hz('G4') : hz('D5'), 0, 0.12, 'triangle', 0.1);
}));

// Game saves: a fresh random completion (0-100%) on every visit
document.querySelectorAll('.save').forEach(save => {
  const pct = Math.floor(Math.random() * 101);
  save.querySelector('.pct').textContent = pct + '% complete';
  save.querySelector('.bar i').style.width = pct + '%';
});

// Memory card blocks: show description on hover/focus
document.querySelectorAll('.block:not(.save)').forEach(b => {
  const showDetail = () => {
    const detail = b.closest('.slot-card').querySelector('.detail');
    if (detail && b.dataset.desc) detail.textContent = b.dataset.desc;
    tone(880, 0, 0.05, 'square', 0.04);
  };
  b.addEventListener('mouseenter', showDetail);
  b.addEventListener('focus', showDetail);
});

// ========== EASTER EGG: GAMEBREAKER ==========
// Type GAMEBREAKER on the main menu, like a cheat code. A nod to NFL Street 2.
const CODE = 'GAMEBREAKER';
let typed = '', breaking = false;

function noise(start, dur, vol) {
  const len = ctx.sampleRate * dur, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf;
  g.gain.value = vol;
  src.connect(g).connect(out);
  src.start(ctx.currentTime + start);
}

function gamebreakerSound() {
  if (!ctx) return;
  const t = ctx.currentTime;
  // rising whoosh
  const w = ctx.createOscillator(), wg = ctx.createGain();
  w.type = 'sawtooth';
  w.frequency.setValueAtTime(110, t);
  w.frequency.exponentialRampToValueAtTime(880, t + 0.35);
  wg.gain.setValueAtTime(0.001, t);
  wg.gain.exponentialRampToValueAtTime(0.07, t + 0.3);
  wg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  w.connect(wg).connect(out);
  w.start(t); w.stop(t + 0.4);
  // impact: noise burst + dropping kick
  noise(0.35, 0.4, 0.25);
  const k = ctx.createOscillator(), kg = ctx.createGain();
  k.frequency.setValueAtTime(150, t + 0.35);
  k.frequency.exponentialRampToValueAtTime(40, t + 0.8);
  kg.gain.setValueAtTime(0.4, t + 0.35);
  kg.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  k.connect(kg).connect(out);
  k.start(t + 0.35); k.stop(t + 0.9);
  // celebration stabs
  ['G4', 'B4', 'D5', 'G5'].forEach((n, i) => tone(hz(n), 0.6 + i * 0.09, 0.2, 'square', 0.05));
  tone(hz('G5'), 1.0, 0.9, 'square', 0.04);
  tone(hz('D5'), 1.0, 0.9, 'square', 0.04);
}

function gamebreaker() {
  if (breaking) return;
  breaking = true;
  gamebreakerSound();

  const fx = document.createElement('div');
  fx.id = 'gamebreaker';
  fx.innerHTML = '<div class="gb-flash"></div><div class="gb-text">GAMEBREAKER!</div>';
  ['+STYLE', '+500', '+1,000', '+250', 'SICK!', '+STYLE', '+750', 'NICE!'].forEach((p, i) => {
    const pop = document.createElement('span');
    pop.className = 'gb-pop';
    pop.textContent = p;
    pop.style.left = 8 + Math.random() * 80 + '%';
    pop.style.top = 15 + Math.random() * 70 + '%';
    pop.style.animationDelay = 0.5 + i * 0.12 + 's';
    fx.appendChild(pop);
  });
  document.body.appendChild(fx);

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // screen shake on impact
    document.getElementById('menu').animate(
      [0, -12, 10, -8, 6, -3, 0].map((x, i) => ({ transform: `translate(${x}px, ${i % 2 ? 6 : -6}px)` })),
      { duration: 400, delay: 350 });
    // the cube jukes left, right, then spins
    big.animate([
      { transform: 'none' },
      { transform: 'translateX(-40px) rotateY(-30deg)', offset: 0.15 },
      { transform: 'translateX(40px) rotateY(30deg)', offset: 0.3 },
      { transform: 'translateX(0) rotateY(720deg)' },
    ], { duration: 1400, easing: 'cubic-bezier(.3, .7, .4, 1)' });
  }

  setTimeout(() => { fx.remove(); breaking = false; }, 2700);
}

// ========== KEYBOARD ==========
addEventListener('keydown', e => {
  if (e.target === muteBtn && (e.key === 'Enter' || e.key === ' ')) return; // let the button's click handle it
  const screen = activeScreen();
  if (screen === 'start') {
    if (e.key === 'm' || e.key === 'M') return setMuted(!muted);
    return begin();
  }
  if (screen === 'boot')  { skip = true; return; }

  // main menu
  if (e.key === 'Escape' || e.key === 'Backspace') return openIdx !== null ? closePanel() : goHome();
  if (openIdx !== null) return;
  if (e.key.length === 1) { // track letters typed for the GAMEBREAKER code
    typed = (typed + e.key.toUpperCase()).slice(-CODE.length);
    if (typed === CODE) { typed = ''; gamebreaker(); }
  }
  const dir = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[e.key];
  if (dir !== undefined) { e.preventDefault(); select(dir); }
  if (e.key === 'Enter') openPanel(sel);
});

// ========== FLOATING BACKGROUND CUBES ==========
for (let i = 0; i < 10; i++) {
  const w = document.createElement('div');
  w.className = 'floaty';
  w.style.left = Math.random() * 100 + 'vw';
  w.style.animationDuration = 15 + Math.random() * 20 + 's';
  w.style.animationDelay = -Math.random() * 30 + 's';
  const c = makeCube(14 + Math.random() * 16);
  // give each cube its own spin: random axis mix, direction, speed and starting point
  const turns = () => (Math.floor(Math.random() * 3) - 1) * 360 + 'deg'; // -360, 0 or 360
  c.style.setProperty('--rx', turns());
  c.style.setProperty('--ry', (Math.random() < .5 ? -360 : 360) + 'deg');
  c.style.setProperty('--rz', turns());
  c.style.animationDuration = 5 + Math.random() * 9 + 's';
  c.style.animationDelay = -Math.random() * 14 + 's';
  w.appendChild(c);
  document.body.prepend(w);
}