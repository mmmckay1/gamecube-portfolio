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
let ctx; // created on first click/key (browsers require this)

function tone(freq, start, dur, type = 'sine', vol = 0.15) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
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
async function begin() {
  if (starting) return; // ignore extra clicks/keys while audio wakes up
  starting = true;
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  // wait for the sound hardware to actually be running so the first blips line up with the cube
  await ctx.resume();
  starting = false;
  boot();
}
document.getElementById('start').addEventListener('click', begin);

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
big.querySelector('.front').textContent = 'YN'; // your initials
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

// Memory card blocks: show description on hover/focus
document.querySelectorAll('.block').forEach(b => {
  const showDetail = () => {
    b.closest('.panel').querySelector('.detail').textContent = b.dataset.desc;
    tone(880, 0, 0.05, 'square', 0.04);
  };
  b.addEventListener('mouseenter', showDetail);
  b.addEventListener('focus', showDetail);
});

// ========== KEYBOARD ==========
addEventListener('keydown', e => {
  const screen = activeScreen();
  if (screen === 'start') return begin();
  if (screen === 'boot')  { skip = true; return; }

  // main menu
  if (e.key === 'Escape' || e.key === 'Backspace') return openIdx !== null ? closePanel() : goHome();
  if (openIdx !== null) return;
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