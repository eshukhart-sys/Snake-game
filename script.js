const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const lengthDisplay = document.getElementById('length');
const fillDisplay = document.getElementById('fill');
const bestDisplay = document.getElementById('best');
const timerDisplay = document.getElementById('timer');
const overlay = document.getElementById('overlayLayer');
const playButton = document.getElementById('playButton');
const restartButton = document.getElementById('restartButton');
const mobileControls = document.getElementById('mobileControls');
const mobileButtons = Array.from(document.querySelectorAll('.control-pad'));
const fullscreenButton = document.getElementById('fullscreenButton');
const canvasShell = document.querySelector('.canvas-shell');
const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent);

const BASE_CANVAS_SIZE = 896;
const CELL = 28;
const COLS = BASE_CANVAS_SIZE / CELL;
const ROWS = BASE_CANVAS_SIZE / CELL;
const TOTAL_CELLS = COLS * ROWS;
const TRAP_INTERVAL = 5;
const CACTUS_INTERVAL = 15;
const WARNING_DURATION = 1;
const MOVE_SPEED = 6;
const APPLE_GROW = 5;
const MAX_HAZARDS = 5;

const controls = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 }
};

const state = {
  running: false,
  over: false,
  won: false,
  score: 0,
  time: 0,
  bestScore: Number(localStorage.getItem('snake-garden-best') || '0'),
  snake: null,
  foods: [],
  apple: null,
  traps: [],
  trapWarnings: [],
  cacti: [],
  cactusWarnings: [],
  particles: [],
  decor: [],
  trapTimer: 0,
  cactusTimer: 0,
  pendingTrapWarnings: 0,
  pendingCactusWarnings: 0,
  nextTrapDelay: 0,
  nextCactusDelay: 0,
  flash: 0,
  fade: 0,
  lastTime: 0
};

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

function equalCells(a, b) {
  return a.x === b.x && a.y === b.y;
}

const mobileControlMap = {
  up: controls.ArrowUp,
  down: controls.ArrowDown,
  left: controls.ArrowLeft,
  right: controls.ArrowRight
};

let touchStart = null;

function setDirection(direction) {
  if (!direction || !state.running) return;
  if (state.snake.turnLocked) return;
  if (direction.x === -state.snake.direction.x && direction.y === -state.snake.direction.y) return;
  if (direction.x === state.snake.direction.x && direction.y === state.snake.direction.y) return;
  state.snake.nextDirection = direction;
  state.snake.turnLocked = true;
}

function getRandomCell() {
  return { x: randomInt(COLS), y: randomInt(ROWS) };
}

function isOccupied(cell) {
  if (state.snake.cells.some(item => equalCells(item, cell))) return true;
  if (state.foods.some(item => equalCells(item.cell, cell))) return true;
  if (state.apple && equalCells(state.apple.cell, cell)) return true;
  if (state.traps.some(item => equalCells(item.cell, cell))) return true;
  if (state.trapWarnings.some(item => equalCells(item.cell, cell))) return true;
  if (state.cacti.some(item => equalCells(item.cell, cell))) return true;
  if (state.cactusWarnings.some(item => equalCells(item.cell, cell))) return true;
  return false;
}

function getSpawnCell() {
  let cell;
  do {
    cell = getRandomCell();
  } while (isOccupied(cell));
  return cell;
}

function createDecor() {
  state.decor = Array.from({ length: 110 }, () => ({
    cell: getRandomCell(),
    rotation: Math.random() * Math.PI * 2,
    size: 0.6 + Math.random() * 0.6,
    type: Math.random() < 0.5 ? 'grass' : 'stone'
  }));
}

function createSnake() {
  return {
    cells: [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }],
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    grow: 0,
    speed: MOVE_SPEED,
    moveProgress: 0,
    sweat: 0,
    turnLocked: false
  };
}

function createMouse() {
  return {
    cell: getSpawnCell(),
    wiggle: Math.random() * Math.PI * 2,
    headTurn: Math.random() * 0.4 - 0.2
  };
}

function createApple() {
  return {
    cell: getSpawnCell(),
    rotation: 0,
    glow: 0
  };
}

function createTrap(cell) {
  return { cell, pulse: 0 };
}

function createCactus(cell) {
  return { cell, sway: Math.random() * Math.PI * 2 };
}

function updateHUD() {
  scoreDisplay.textContent = state.score;
  lengthDisplay.textContent = state.snake.cells.length;
  fillDisplay.textContent = `${Math.floor((state.snake.cells.length / TOTAL_CELLS) * 100)}%`;
  bestDisplay.textContent = state.bestScore;
  timerDisplay.textContent = formatTime(state.time);
}

function showOverlay(title, message, visible, score = 0, length = 1, time = '00:00', buttonText = 'Начать игру') {
  document.getElementById('overlayTitle').textContent = title;
  document.getElementById('overlayMessage').textContent = message;
  document.getElementById('overlayScore').textContent = score;
  document.getElementById('overlayLength').textContent = length;
  document.getElementById('overlayTime').textContent = time;
  playButton.textContent = buttonText;
  overlay.classList.toggle('hidden', !visible);
}

function initGame() {
  state.snake = createSnake();
  state.foods = Array.from({ length: 4 }, createMouse);
  state.apple = createApple();
  state.traps = [];
  state.trapWarnings = [];
  state.cacti = [];
  state.cactusWarnings = [];
  state.pendingTrapWarnings = 0;
  state.pendingCactusWarnings = 0;
  state.nextTrapDelay = TRAP_INTERVAL;
  state.nextCactusDelay = CACTUS_INTERVAL;
  createDecor();
  state.particles = [];
  state.flash = 0;
  state.fade = 0;
  state.sweat = 0;
}

function getHazardCount() {
  const ratio = state.snake.cells.length / TOTAL_CELLS;
  if (ratio >= 0.9) return 0;
  if (ratio >= 0.8) return 1;
  if (ratio >= 0.75) return 2;
  if (ratio >= 0.65) return 3;
  if (ratio >= 0.5) return 4;
  return 5;
}

function spawnHazardWarning(type) {
  const cell = getSpawnCell();
  if (type === 'trap') {
    state.trapWarnings.push({ cell, timer: WARNING_DURATION, pulse: 0 });
  } else {
    state.cactusWarnings.push({ cell, timer: WARNING_DURATION, pulse: 0 });
  }
}

function startGame() {
  initGame();
  state.score = 0;
  state.time = 0;
  state.running = true;
  state.over = false;
  state.won = false;
  state.lastTime = performance.now();
  updateHUD();
  showOverlay('', '', false);
  if (isMobileDevice) {
    enterFullscreen().catch(() => {});
  }
}

function endGame(won) {
  state.running = false;
  state.over = true;
  state.won = won;
  if (state.score > state.bestScore) {
    setBestScore(state.score);
  }
  showOverlay(
    won ? 'Поле полностью захвачено!' : 'Игра окончена',
    won
      ? 'Поздравляем! Ваша змейка заняла всё поле.'
      : 'Змейка столкнулась. Попробуйте ещё раз.',
    true,
    state.score,
    state.snake.cells.length,
    formatTime(state.time),
    'Играть снова'
  );
}

function setBestScore(value) {
  state.bestScore = value;
  localStorage.setItem('snake-garden-best', String(value));
}

function spawnItems() {
  if (state.foods.length < 4) state.foods.push(createMouse());
  if (!state.apple) state.apple = createApple();
}

function updateHazards(dt) {
  state.trapTimer -= dt;
  if (state.trapTimer <= 0 && state.pendingTrapWarnings === 0 && state.trapWarnings.length === 0) {
    state.pendingTrapWarnings = getHazardCount();
    state.nextTrapDelay = 0.15 + Math.random() * 0.5;
    state.trapTimer = TRAP_INTERVAL;
  }

  if (state.pendingTrapWarnings > 0) {
    state.nextTrapDelay -= dt;
    if (state.nextTrapDelay <= 0) {
      spawnHazardWarning('trap');
      state.pendingTrapWarnings -= 1;
      state.nextTrapDelay = 0.15 + Math.random() * 0.5;
    }
  }

  state.trapWarnings.forEach(warning => {
    warning.timer -= dt;
    warning.pulse += dt * 6;
  });
  const readyTraps = state.trapWarnings.filter(w => w.timer <= 0);
  if (readyTraps.length) {
    state.traps.push(...readyTraps.map(w => createTrap(w.cell)));
    state.trapWarnings = state.trapWarnings.filter(w => w.timer > 0);
  }

  state.cactusTimer -= dt;
  if (state.cactusTimer <= 0 && state.pendingCactusWarnings === 0 && state.cactusWarnings.length === 0) {
    state.pendingCactusWarnings = getHazardCount();
    state.nextCactusDelay = 0.2 + Math.random() * 0.6;
    state.cactusTimer = CACTUS_INTERVAL;
  }

  if (state.pendingCactusWarnings > 0) {
    state.nextCactusDelay -= dt;
    if (state.nextCactusDelay <= 0) {
      spawnHazardWarning('cactus');
      state.pendingCactusWarnings -= 1;
      state.nextCactusDelay = 0.2 + Math.random() * 0.6;
    }
  }

  state.cactusWarnings.forEach(warning => {
    warning.timer -= dt;
    warning.pulse += dt * 6;
  });
  const readyCacti = state.cactusWarnings.filter(w => w.timer <= 0);
  if (readyCacti.length) {
    state.cacti.push(...readyCacti.map(w => createCactus(w.cell)));
    state.cactusWarnings = state.cactusWarnings.filter(w => w.timer > 0);
  }

  const target = getHazardCount();
  if (state.traps.length > target) state.traps.length = target;
  if (state.cacti.length > target) state.cacti.length = target;
}

function moveSnake(dt) {
  state.snake.moveProgress += dt;
  const step = 1 / state.snake.speed;
  while (state.snake.moveProgress >= step && state.running) {
    state.snake.moveProgress -= step;
    const head = state.snake.cells[0];
    state.snake.direction = state.snake.nextDirection;
    const next = { x: head.x + state.snake.direction.x, y: head.y + state.snake.direction.y };
    state.snake.cells.unshift(next);
    if (state.snake.grow > 0) state.snake.grow -= 1;
    else state.snake.cells.pop();
    state.snake.turnLocked = false;
    handleCollisions();
    if (!state.running) break;
  }
}

function handleCollisions() {
  const head = state.snake.cells[0];
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return endGame(false);
  if (state.snake.cells.slice(1).some(cell => equalCells(cell, head))) return endGame(false);
  if (state.traps.some(item => equalCells(item.cell, head))) return endGame(false);

  const mouseIndex = state.foods.findIndex(item => equalCells(item.cell, head));
  if (mouseIndex >= 0) {
    state.score += 10;
    state.snake.grow += 1;
    spawnParticles(head, 16, { r: 225, g: 200, b: 110 });
    state.foods[mouseIndex] = createMouse();
  }

  if (state.apple && equalCells(state.apple.cell, head)) {
    state.score += 70;
    state.snake.grow += APPLE_GROW;
    state.flash = 0.9;
    spawnParticles(head, 32, { r: 255, g: 222, b: 80 });
    state.apple = createApple();
  }

  const cactusIndex = state.cacti.findIndex(item => equalCells(item.cell, head));
  if (cactusIndex >= 0) {
    state.score = Math.max(0, state.score - 12);
    state.snake.grow = Math.max(0, state.snake.grow - 1);
    state.snake.sweat = 1;
    state.sweat = 1;
    if (state.snake.cells.length > 2) state.snake.cells.pop();
    if (state.snake.cells.length > 2) state.snake.cells.pop();
    spawnParticles(head, 18, { r: 120, g: 235, b: 255 });
    state.cacti.splice(cactusIndex, 1);
  }

  if (state.snake.cells.length >= TOTAL_CELLS) return endGame(true);
}

function spawnParticles(cell, count, color) {
  const cx = cell.x * CELL + CELL / 2;
  const cy = cell.y * CELL + CELL / 2;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.4 + 1.1;
    state.particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 28 + Math.random() * 16,
      radius: 1 + Math.random() * 1.8,
      color,
      gravity: 0.04
    });
  }
}

function updateParticles() {
  state.particles = state.particles.filter(p => p.life > 0);
  state.particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.life -= 1;
  });
}

function drawParticles() {
  state.particles.forEach(p => {
    ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.life / 40})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#144033');
  gradient.addColorStop(0.45, '#0c2419');
  gradient.addColorStop(1, '#050c09');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  state.decor.forEach(item => {
    const cx = item.cell.x * CELL + CELL / 2;
    const cy = item.cell.y * CELL + CELL / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(item.rotation);
    if (item.type === 'stone') {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.ellipse(0, 0, item.size * 4.5, item.size * 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(90, 146, 106, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, item.size * 4.5);
      ctx.lineTo(0, -item.size * 4.5);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawFood() {
  state.foods.forEach(food => {
    food.wiggle += 0.035;
    const cx = food.cell.x * CELL + CELL / 2 + Math.sin(food.wiggle * 1.1) * 1.6;
    const cy = food.cell.y * CELL + CELL / 2 + Math.cos(food.wiggle * 1.4) * 1.3;

    const bodyX = CELL * 0.38;
    const bodyY = CELL * 0.24;
    ctx.fillStyle = '#c1c0b1';
    ctx.beginPath();
    ctx.ellipse(cx, cy, bodyX, bodyY, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e3e2d8';
    ctx.beginPath();
    ctx.arc(cx - bodyX * 0.4, cy - bodyY * 0.55, CELL * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - bodyX * 0.15, cy - bodyY * 0.55, CELL * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#26221e';
    ctx.beginPath();
    ctx.arc(cx - bodyX * 0.35 + Math.cos(food.wiggle) * 0.8, cy - 1, CELL * 0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(88, 72, 62, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + bodyX * 0.9, cy + 1);
    ctx.quadraticCurveTo(cx + bodyX * 1.55, cy + CELL * 0.18, cx + bodyX * 2, cy - CELL * 0.05);
    ctx.stroke();

    ctx.fillStyle = '#dfe0d3';
    ctx.save();
    ctx.translate(cx - bodyX * 0.3, cy - bodyY * 0.65);
    ctx.rotate(food.headTurn);
    ctx.beginPath();
    ctx.ellipse(0, 0, CELL * 0.09, CELL * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawApple() {
  if (!state.apple) return;
  state.apple.rotation += 0.03;
  state.apple.glow = 0.6 + Math.sin(state.apple.rotation * 3) * 0.14;
  const cx = state.apple.cell.x * CELL + CELL / 2;
  const cy = state.apple.cell.y * CELL + CELL / 2;
  const radius = CELL * 0.45;

  const gradient = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, radius * 0.1, cx, cy, radius);
  gradient.addColorStop(0, '#fff4aa');
  gradient.addColorStop(0.4, '#ffd843');
  gradient.addColorStop(1, '#c87a0d');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.apple.rotation);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.92, Math.sin(state.apple.rotation * 0.6) * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.shadowColor = 'rgba(255, 220, 130, 0.45)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = `rgba(255, 235, 145, ${state.apple.glow})`;
  ctx.beginPath();
  ctx.arc(cx - radius * 0.18, cy - radius * 0.15, CELL * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#7d5d24';
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - radius * 0.84);
  ctx.quadraticCurveTo(cx + 4, cy - radius * 1.15, cx + 2, cy - radius * 0.54);
  ctx.lineTo(cx + 1.8, cy - radius * 0.6);
  ctx.fill();
}

function drawWarnings() {
  state.trapWarnings.forEach(warning => {
    const cx = warning.cell.x * CELL + CELL / 2;
    const cy = warning.cell.y * CELL + CELL / 2;
    const pulse = 0.6 + Math.sin(warning.pulse) * 0.12;
    ctx.strokeStyle = `rgba(255, 80, 80, ${0.72 - warning.timer * 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * pulse * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  });

  state.cactusWarnings.forEach(warning => {
    const cx = warning.cell.x * CELL + CELL / 2;
    const cy = warning.cell.y * CELL + CELL / 2;
    const pulse = 0.6 + Math.sin(warning.pulse * 0.95) * 0.14;
    ctx.strokeStyle = `rgba(120, 255, 120, ${0.62 - warning.timer * 0.28})`;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

function drawTraps() {
  state.traps.forEach(trap => {
    trap.pulse += 0.06;
    const cx = trap.cell.x * CELL + CELL / 2;
    const cy = trap.cell.y * CELL + CELL / 2;
    const radius = CELL * 0.38 + Math.sin(trap.pulse) * 1.1;
    ctx.fillStyle = '#1d1817';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9a1823';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.56, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#4e1320';
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const x1 = cx + Math.cos(angle) * radius * 1.1;
      const y1 = cy + Math.sin(angle) * radius * 1.1;
      const x2 = cx + Math.cos(angle) * radius * 0.6;
      const y2 = cy + Math.sin(angle) * radius * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function drawCacti() {
  state.cacti.forEach(cactus => {
    cactus.sway += 0.03;
    const cx = cactus.cell.x * CELL + CELL / 2;
    const cy = cactus.cell.y * CELL + CELL / 2;
    const sway = Math.sin(cactus.sway) * 0.12;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sway);
    ctx.fillStyle = '#31926c';
    ctx.beginPath();
    ctx.ellipse(0, 0, CELL * 0.26, CELL * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#246f53';
    ctx.beginPath();
    ctx.ellipse(-CELL * 0.34, -CELL * 0.02, CELL * 0.18, CELL * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(CELL * 0.34, -CELL * 0.07, CELL * 0.16, CELL * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1b4d3c';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      const y = -CELL * 0.4 + i * CELL * 0.2;
      ctx.beginPath();
      ctx.moveTo(-CELL * 0.12, y);
      ctx.lineTo(CELL * 0.12, y);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawSnake() {
  const path = state.snake.cells.map(cell => ({ x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 }));
  const progress = clamp(state.snake.moveProgress / (1 / state.snake.speed), 0, 1);
  if (state.snake.direction.x !== 0 || state.snake.direction.y !== 0) {
    path[0] = {
      x: path[0].x + state.snake.direction.x * progress * CELL,
      y: path[0].y + state.snake.direction.y * progress * CELL
    };
  }

  if (path.length > 1) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#bff5a8');
    gradient.addColorStop(1, '#178f39');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = CELL * 0.9;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  const head = state.snake.cells[0];
  const hx = head.x * CELL + CELL / 2;
  const hy = head.y * CELL + CELL / 2;
  const radius = CELL * 0.55;
  const headGradient = ctx.createRadialGradient(hx - radius * 0.25, hy - radius * 0.2, 1, hx, hy, radius);
  headGradient.addColorStop(0, '#e8ffe0');
  headGradient.addColorStop(1, '#1e7c41');
  ctx.fillStyle = headGradient;
  ctx.beginPath();
  ctx.ellipse(hx, hy, radius, radius * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  const forward = state.snake.direction;
  const perpX = -forward.y;
  const perpY = forward.x;
  const eyeSize = CELL * 0.1;
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(hx + forward.x * radius * 0.28 + perpX * radius * 0.15, hy + forward.y * radius * 0.28 + perpY * radius * 0.15, eyeSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx + forward.x * radius * 0.28 - perpX * radius * 0.15, hy + forward.y * radius * 0.28 - perpY * radius * 0.15, eyeSize, 0, Math.PI * 2);
  ctx.fill();

  if (state.snake.sweat > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < 7; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = radius * (0.35 + Math.random() * 0.22);
      ctx.beginPath();
      ctx.ellipse(hx + Math.cos(angle) * distance, hy + Math.sin(angle) * distance, 2, 5, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawEffects() {
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 235, 170, ${state.flash})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (state.fade > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${state.fade})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function gameLoop(currentTime) {
  if (!state.lastTime) state.lastTime = currentTime;
  const dt = Math.min((currentTime - state.lastTime) / 1000, 0.04);
  state.lastTime = currentTime;
  if (state.running) {
    state.time += dt;
    state.flash = Math.max(0, state.flash - dt * 1.8);
    state.snake.sweat = Math.max(0, state.snake.sweat - dt);
    state.fade = state.over ? Math.min(1, state.fade + dt * 0.45) : 0;
    updateHazards(dt);
    moveSnake(dt);
    spawnItems();
    updateParticles();
    updateHUD();
  }

  drawBackground();
  drawWarnings();
  drawFood();
  drawApple();
  drawTraps();
  drawCacti();
  if (state.running || state.over) drawSnake();
  drawParticles();
  drawEffects();

  requestAnimationFrame(gameLoop);
}

function handleKey(event) {
  if (event.code === 'Space' && !state.running) {
    startGame();
    return;
  }
  if (!controls[event.code] || !state.running) return;
  setDirection(controls[event.code]);
}

function bindEvents() {
  window.addEventListener('keydown', handleKey);
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);
  document.addEventListener('fullscreenchange', resizeCanvas);
  document.addEventListener('webkitfullscreenchange', resizeCanvas);
  document.addEventListener('mozfullscreenchange', resizeCanvas);
  document.addEventListener('MSFullscreenChange', resizeCanvas);
  playButton.addEventListener('click', startGame);
  restartButton.addEventListener('click', startGame);
  fullscreenButton.addEventListener('click', enterFullscreen);

  mobileButtons.forEach(button => {
    const direction = button.dataset.dir;
    const target = mobileControlMap[direction];
    button.addEventListener('click', () => setDirection(target));
    button.addEventListener('touchstart', event => {
      event.preventDefault();
      setDirection(target);
    }, { passive: false });
  });

  canvas.addEventListener('touchstart', event => {
    if (!state.running) return;
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  canvas.addEventListener('touchmove', event => {
    if (!state.running) return;
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', event => {
    if (!state.running || !touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < 24) {
      touchStart = null;
      return;
    }
    const direction = absX > absY
      ? (dx > 0 ? controls.ArrowRight : controls.ArrowLeft)
      : (dy > 0 ? controls.ArrowDown : controls.ArrowUp);
    setDirection(direction);
    touchStart = null;
  }, { passive: true });

}

function enterFullscreen() {
  const target = canvasShell || canvas;
  if (target.requestFullscreen) return target.requestFullscreen();
  if (target.webkitRequestFullscreen) return target.webkitRequestFullscreen();
  if (target.msRequestFullscreen) return target.msRequestFullscreen();
  return Promise.resolve();
}

function resizeCanvas() {
  if (isMobileDevice) {
    canvas.width = BASE_CANVAS_SIZE;
    canvas.height = BASE_CANVAS_SIZE;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function initialize() {
  resizeCanvas();
  initGame();
  updateHUD();
  showOverlay('Snake Garden', 'Нажмите кнопку или пробел для старта.', true, 0, 1, '00:00', 'Начать игру');
  bindEvents();
  requestAnimationFrame(gameLoop);
}

initialize();
