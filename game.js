const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const world = {
  width: 2400,
  height: 1800,
};

const keys = new Set();

const islands = [
  { id: "base", x: 260, y: 1450, r: 140, type: "base", name: "База" },
  { id: "i1", x: 740, y: 1260, r: 110, type: "resource", name: "Мшистый" },
  { id: "i2", x: 990, y: 420, r: 125, type: "enemy", name: "Пиратский" },
  { id: "i3", x: 1540, y: 640, r: 90, type: "resource", name: "Каменный" },
  { id: "i4", x: 1650, y: 1220, r: 145, type: "enemy", name: "Чёрный риф" },
  { id: "i5", x: 2100, y: 420, r: 85, type: "unique", name: "Осколок" },
  { id: "i6", x: 2080, y: 980, r: 130, type: "resource", name: "Пальмовый" },
  { id: "i7", x: 1230, y: 1560, r: 105, type: "unique", name: "Обелиск" },
];

const resources = [];
const enemies = [];

function islandById(id) {
  return islands.find((i) => i.id === id);
}

for (const island of islands) {
  const count = island.type === "resource" ? 5 : island.type === "unique" ? 3 : 2;
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const d = 24 + Math.random() * (island.r - 34);
    resources.push({
      islandId: island.id,
      x: island.x + Math.cos(a) * d,
      y: island.y + Math.sin(a) * d,
      kind: island.type === "unique" ? "artifact" : Math.random() > 0.55 ? "metal" : "wood",
      taken: false,
    });
  }

  if (island.type === "enemy") {
    for (let i = 0; i < 3; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const d = 18 + Math.random() * (island.r - 44);
      enemies.push({
        islandId: island.id,
        x: island.x + Math.cos(a) * d,
        y: island.y + Math.sin(a) * d,
        dir: Math.random() * Math.PI * 2,
      });
    }
  }
}

const state = {
  discovered: new Set(["base"]),
  visited: new Set(["base"]),
  mode: "ship",
  activeIslandId: "base",
  ship: {
    x: 360,
    y: 1420,
    angle: -0.4,
    speed: 0,
    hp: 100,
    maxHp: 100,
    speedLevel: 0,
    hullLevel: 0,
    cargoLevel: 0,
  },
  player: {
    x: 260,
    y: 1450,
    hp: 100,
    maxHp: 100,
  },
  inventory: {
    wood: 0,
    metal: 0,
    artifact: 0,
  },
  note: "Отплывайте от базы и открывайте острова.",
  noteTimer: 6,
  hitFlash: 0,
};

function shipMaxSpeed() {
  return 110 + state.ship.speedLevel * 28;
}

function cargoMax() {
  return 12 + state.ship.cargoLevel * 6;
}

function cargoUsed() {
  return state.inventory.wood + state.inventory.metal + state.inventory.artifact;
}

function setNote(text, ttl = 2.6) {
  state.note = text;
  state.noteTimer = ttl;
}

function getNearIsland(x, y, extra = 0) {
  for (const island of islands) {
    if (Math.hypot(x - island.x, y - island.y) <= island.r + extra) return island;
  }
  return null;
}

function updateDiscovery() {
  const sx = state.ship.x;
  const sy = state.ship.y;
  for (const island of islands) {
    const d = Math.hypot(sx - island.x, sy - island.y);
    if (d < 350) state.discovered.add(island.id);
    if (d < island.r + 95) state.visited.add(island.id);
  }
}

function dockAndRepair() {
  if (state.activeIslandId !== "base") return;
  const missing = state.ship.maxHp - state.ship.hp;
  if (missing <= 0) {
    setNote("Корпус в идеальном состоянии.");
    return;
  }
  const cost = Math.ceil(missing * 0.6);
  const available = state.inventory.wood + state.inventory.metal;
  if (available < cost) {
    setNote(`Не хватает ресурсов для ремонта (${cost}).`);
    return;
  }
  let left = cost;
  while (left > 0 && state.inventory.wood > 0) {
    state.inventory.wood -= 1;
    left -= 1;
  }
  while (left > 0 && state.inventory.metal > 0) {
    state.inventory.metal -= 1;
    left -= 1;
  }
  state.ship.hp = state.ship.maxHp;
  setNote("Корабль отремонтирован на базе.");
}

function tryUpgrade(slot) {
  if (state.mode !== "ship" || state.activeIslandId !== "base") return;

  const options = {
    1: { key: "speedLevel", max: 4, w: 6, m: 5, a: 0, name: "Скорость" },
    2: { key: "hullLevel", max: 4, w: 4, m: 8, a: 0, name: "Прочность" },
    3: { key: "cargoLevel", max: 4, w: 8, m: 2, a: 1, name: "Трюм" },
  };
  const up = options[slot];
  if (!up) return;

  if (state.ship[up.key] >= up.max) {
    setNote(`${up.name} уже максимально улучшена.`);
    return;
  }

  const scale = state.ship[up.key] + 1;
  const costW = up.w * scale;
  const costM = up.m * scale;
  const costA = up.a * scale;

  if (
    state.inventory.wood < costW ||
    state.inventory.metal < costM ||
    state.inventory.artifact < costA
  ) {
    setNote(`Нужно: дерево ${costW}, металл ${costM}, артефакты ${costA}.`);
    return;
  }

  state.inventory.wood -= costW;
  state.inventory.metal -= costM;
  state.inventory.artifact -= costA;
  state.ship[up.key] += 1;

  if (up.key === "hullLevel") {
    state.ship.maxHp = 100 + state.ship.hullLevel * 35;
    state.ship.hp = Math.min(state.ship.maxHp, state.ship.hp + 25);
  }

  setNote(`${up.name} улучшена до ${state.ship[up.key]} ур.`);
}

function tryLandOrBoard() {
  if (state.mode === "ship") {
    if (Math.abs(state.ship.speed) > 18) {
      setNote("Сначала почти полностью остановите корабль.");
      return;
    }
    const island = getNearIsland(state.ship.x, state.ship.y, 22);
    if (!island) {
      setNote("Подплывите к острову, чтобы высадиться.");
      return;
    }
    state.mode = "foot";
    state.activeIslandId = island.id;
    state.player.x = island.x;
    state.player.y = island.y;
    state.visited.add(island.id);
    setNote(`Высадка: ${island.name}.`);
  } else {
    if (!state.activeIslandId) return;
    const island = islandById(state.activeIslandId);
    const d = Math.hypot(state.player.x - state.ship.x, state.player.y - state.ship.y);
    if (d > island.r + 42) {
      setNote("Вернитесь ближе к месту высадки (к кораблю).");
      return;
    }
    state.mode = "ship";
    state.player.hp = state.player.maxHp;
    if (state.activeIslandId === "base") dockAndRepair();
    setNote("Возвращение на корабль.");
  }
}

function gatherNearestResource() {
  if (state.mode !== "foot") return;
  const island = islandById(state.activeIslandId);
  let nearest = null;
  let best = Infinity;
  for (const res of resources) {
    if (res.taken || res.islandId !== island.id) continue;
    const d = Math.hypot(res.x - state.player.x, res.y - state.player.y);
    if (d < best) {
      best = d;
      nearest = res;
    }
  }

  if (!nearest || best > 28) {
    setNote("Нет ресурса рядом для взаимодействия.");
    return;
  }

  if (cargoUsed() >= cargoMax()) {
    setNote("Трюм заполнен. Вернитесь на корабль.");
    return;
  }

  nearest.taken = true;
  state.inventory[nearest.kind] += 1;
  setNote(`Получено: ${nearest.kind}.`);
}

function handleShip(dt) {
  const turnRate = 2.2;
  const accel = 125;
  const reverse = 70;
  const drag = 0.97;

  if (keys.has("a") || keys.has("arrowleft")) state.ship.angle -= turnRate * dt;
  if (keys.has("d") || keys.has("arrowright")) state.ship.angle += turnRate * dt;
  if (keys.has("w") || keys.has("arrowup")) state.ship.speed += accel * dt;
  if (keys.has("s") || keys.has("arrowdown")) state.ship.speed -= reverse * dt;

  const maxFwd = shipMaxSpeed();
  state.ship.speed = Math.max(-50, Math.min(maxFwd, state.ship.speed));
  state.ship.speed *= drag;

  const nx = state.ship.x + Math.cos(state.ship.angle) * state.ship.speed * dt;
  const ny = state.ship.y + Math.sin(state.ship.angle) * state.ship.speed * dt;

  const hitIsland = getNearIsland(nx, ny, -8);
  if (hitIsland) {
    state.ship.speed *= -0.28;
    state.ship.hp -= 14 * dt;
    state.hitFlash = 1;
  } else {
    state.ship.x = Math.max(30, Math.min(world.width - 30, nx));
    state.ship.y = Math.max(30, Math.min(world.height - 30, ny));
  }

  if (state.ship.x <= 34 || state.ship.x >= world.width - 34 || state.ship.y <= 34 || state.ship.y >= world.height - 34) {
    state.ship.speed *= -0.35;
  }

  if (state.ship.hp <= 0) {
    state.ship.hp = state.ship.maxHp;
    state.ship.x = 340;
    state.ship.y = 1420;
    state.ship.speed = 0;
    state.inventory.wood = Math.max(0, state.inventory.wood - 4);
    state.inventory.metal = Math.max(0, state.inventory.metal - 4);
    setNote("Корабль затонул и восстановлен на базе. Потеря ресурсов.", 4.2);
  }

  updateDiscovery();
}

function handleFoot(dt) {
  const island = islandById(state.activeIslandId);
  let mx = 0;
  let my = 0;

  if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
  if (keys.has("d") || keys.has("arrowright")) mx += 1;
  if (keys.has("w") || keys.has("arrowup")) my -= 1;
  if (keys.has("s") || keys.has("arrowdown")) my += 1;

  const len = Math.hypot(mx, my) || 1;
  mx /= len;
  my /= len;

  const speed = 130;
  state.player.x += mx * speed * dt;
  state.player.y += my * speed * dt;

  const dToCenter = Math.hypot(state.player.x - island.x, state.player.y - island.y);
  if (dToCenter > island.r - 8) {
    const ang = Math.atan2(state.player.y - island.y, state.player.x - island.x);
    state.player.x = island.x + Math.cos(ang) * (island.r - 8);
    state.player.y = island.y + Math.sin(ang) * (island.r - 8);
  }

  for (const e of enemies) {
    if (e.islandId !== island.id) continue;
    e.dir += (Math.random() - 0.5) * dt * 2;
    e.x += Math.cos(e.dir) * 42 * dt;
    e.y += Math.sin(e.dir) * 42 * dt;

    const fromCenter = Math.hypot(e.x - island.x, e.y - island.y);
    if (fromCenter > island.r - 14) {
      const ang = Math.atan2(e.y - island.y, e.x - island.x);
      e.x = island.x + Math.cos(ang) * (island.r - 14);
      e.y = island.y + Math.sin(ang) * (island.r - 14);
      e.dir += Math.PI * 0.7;
    }

    if (Math.hypot(e.x - state.player.x, e.y - state.player.y) < 18) {
      state.player.hp -= 26 * dt;
      state.hitFlash = 1;
    }
  }

  if (state.player.hp <= 0) {
    state.player.hp = state.player.maxHp;
    state.player.x = island.x;
    state.player.y = island.y;
    state.inventory.wood = Math.max(0, state.inventory.wood - 1);
    state.inventory.metal = Math.max(0, state.inventory.metal - 1);
    setNote("Вы ранены и потеряли часть ресурсов.");
  }
}

function update(dt) {
  if (state.noteTimer > 0) state.noteTimer -= dt;
  state.hitFlash = Math.max(0, state.hitFlash - dt * 2.4);

  if (state.mode === "ship") handleShip(dt);
  else handleFoot(dt);
}

function cameraTarget() {
  return state.mode === "ship"
    ? { x: state.ship.x, y: state.ship.y }
    : { x: state.player.x, y: state.player.y };
}

function cameraOffset() {
  const target = cameraTarget();
  const ox = Math.max(0, Math.min(world.width - canvas.width, target.x - canvas.width / 2));
  const oy = Math.max(0, Math.min(world.height - canvas.height, target.y - canvas.height / 2));
  return { x: ox, y: oy };
}

function drawOcean(cam) {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#347eb5");
  grad.addColorStop(1, "#0f3558");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = "#d8f1ff";
  for (let x = -((cam.x % 120) + 120); x < canvas.width + 120; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 70, canvas.height);
    ctx.stroke();
  }
  ctx.restore();
}

function islandColor(type) {
  if (type === "base") return "#c7a97c";
  if (type === "enemy") return "#8f5f50";
  if (type === "unique") return "#8886ab";
  return "#79a86f";
}

function drawWorld(cam) {
  for (const island of islands) {
    if (!state.discovered.has(island.id)) continue;
    const sx = island.x - cam.x;
    const sy = island.y - cam.y;

    ctx.fillStyle = islandColor(island.type);
    ctx.beginPath();
    ctx.ellipse(sx, sy, island.r, island.r * 0.84, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(sx, sy + island.r * 0.2, island.r * 0.85, island.r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f1f3f6";
    ctx.font = "12px sans-serif";
    ctx.fillText(island.name, sx - island.r * 0.4, sy - island.r - 8);
  }

  for (const res of resources) {
    if (res.taken) continue;
    if (!state.discovered.has(res.islandId)) continue;
    const sx = res.x - cam.x;
    const sy = res.y - cam.y;
    ctx.fillStyle = res.kind === "wood" ? "#6e4c31" : res.kind === "metal" ? "#9aa0a8" : "#d9c17a";
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of enemies) {
    if (!state.discovered.has(e.islandId)) continue;
    const sx = e.x - cam.x;
    const sy = e.y - cam.y;
    ctx.fillStyle = "#cf5d5d";
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.mode === "ship") {
    const sx = state.ship.x - cam.x;
    const sy = state.ship.y - cam.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(state.ship.angle);
    ctx.fillStyle = "#f2f2ec";
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-12, -8);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-12, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f4c061";
    ctx.fillRect(-2, -12, 3, 10);
    ctx.restore();
  } else {
    const ssx = state.ship.x - cam.x;
    const ssy = state.ship.y - cam.y;
    ctx.fillStyle = "#e9f1f7";
    ctx.beginPath();
    ctx.arc(ssx, ssy, 12, 0, Math.PI * 2);
    ctx.fill();

    const px = state.player.x - cam.x;
    const py = state.player.y - cam.y;
    ctx.fillStyle = "#f6d4b5";
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();

    let near = null;
    let best = Infinity;
    for (const res of resources) {
      if (res.taken || res.islandId !== state.activeIslandId) continue;
      const d = Math.hypot(res.x - state.player.x, res.y - state.player.y);
      if (d < best) {
        best = d;
        near = res;
      }
    }
    if (near && best < 30) {
      ctx.strokeStyle = "#fff387";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(near.x - cam.x, near.y - cam.y, 11, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.fillStyle = "rgba(4,10,20,0.45)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const island of islands) {
    if (!state.discovered.has(island.id)) continue;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(island.x - cam.x, island.y - cam.y, island.r + 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawUi() {
  ctx.fillStyle = "rgba(3,13,24,0.7)";
  ctx.fillRect(10, 10, 430, 146);
  ctx.fillStyle = "#eef8ff";
  ctx.font = "15px sans-serif";

  const modeLabel = state.mode === "ship" ? "корабль" : `пешком (${islandById(state.activeIslandId).name})`;
  ctx.fillText(`Режим: ${modeLabel}`, 20, 32);
  ctx.fillText(`HP корабля: ${state.ship.hp.toFixed(0)}/${state.ship.maxHp}`, 20, 54);
  ctx.fillText(`HP персонажа: ${state.player.hp.toFixed(0)}/${state.player.maxHp}`, 20, 76);
  ctx.fillText(`Ресурсы: дерево ${state.inventory.wood}, металл ${state.inventory.metal}, артефакты ${state.inventory.artifact}`, 20, 98);
  ctx.fillText(`Трюм: ${cargoUsed()}/${cargoMax()} | Открыто островов: ${state.discovered.size}/${islands.length}`, 20, 120);
  ctx.fillText(`Улучшения: скорость ${state.ship.speedLevel}, корпус ${state.ship.hullLevel}, трюм ${state.ship.cargoLevel}`, 20, 142);

  if (state.noteTimer > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(200, canvas.height - 45, 560, 30);
    ctx.fillStyle = "#f3fbff";
    ctx.fillText(state.note, 212, canvas.height - 25);
  }

  const mapW = 220;
  const mapH = 140;
  const mapX = canvas.width - mapW - 12;
  const mapY = 12;
  ctx.fillStyle = "rgba(2,9,16,0.72)";
  ctx.fillRect(mapX, mapY, mapW, mapH);
  ctx.strokeStyle = "#4f7da0";
  ctx.strokeRect(mapX, mapY, mapW, mapH);

  for (const island of islands) {
    if (!state.discovered.has(island.id)) continue;
    const x = mapX + (island.x / world.width) * mapW;
    const y = mapY + (island.y / world.height) * mapH;
    ctx.fillStyle = state.visited.has(island.id) ? "#c6f0ff" : "#5a95b6";
    ctx.beginPath();
    ctx.arc(x, y, island.type === "base" ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const actor = state.mode === "ship" ? state.ship : state.player;
  ctx.fillStyle = "#ffd66e";
  ctx.beginPath();
  ctx.arc(mapX + (actor.x / world.width) * mapW, mapY + (actor.y / world.height) * mapH, 3, 0, Math.PI * 2);
  ctx.fill();

  if (state.activeIslandId === "base" && state.mode === "ship") {
    ctx.fillStyle = "#d9f0ff";
    ctx.fillText("База: 1-скорость, 2-корпус, 3-трюм, E-ремонт", 468, 28);
  }

  if (state.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,60,60,${0.2 * state.hitFlash})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function render() {
  const cam = cameraOffset();
  drawOcean(cam);
  drawWorld(cam);
  drawUi();
}

document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);

  if (k === "e") {
    if (state.mode === "foot") gatherNearestResource();
    tryLandOrBoard();
  }

  if (k === "1" || k === "2" || k === "3") {
    tryUpgrade(Number(k));
  }
});

document.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
});

let previous = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - previous) / 1000);
  previous = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
