const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const world = {
  width: 14000,
  height: 10000,
};

const keys = new Set();

const islands = [
  { id: "base", x: 900, y: 8300, r: 210, type: "base", name: "База (900,8300)" },
  { id: "i1", x: 2200, y: 7300, r: 180, type: "resource", name: "Лагуна (2200,7300)" },
  { id: "i2", x: 3400, y: 5700, r: 220, type: "enemy", name: "Клык (3400,5700)" },
  { id: "i3", x: 4700, y: 8100, r: 170, type: "resource", name: "Пальмы (4700,8100)" },
  { id: "i4", x: 6000, y: 6800, r: 200, type: "enemy", name: "Корсар (6000,6800)" },
  { id: "i5", x: 7200, y: 5000, r: 190, type: "resource", name: "Штиль (7200,5000)" },
  { id: "i6", x: 8600, y: 7600, r: 230, type: "unique", name: "Монолит (8600,7600)" },
  { id: "i7", x: 9900, y: 4200, r: 170, type: "resource", name: "Риф (9900,4200)" },
  { id: "i8", x: 11300, y: 6100, r: 210, type: "enemy", name: "Разлом (11300,6100)" },
  { id: "i9", x: 12600, y: 3100, r: 150, type: "unique", name: "Обелиск (12600,3100)" },
];

const resources = [];
const enemies = [];

function islandById(id) {
  return islands.find((i) => i.id === id);
}

for (const island of islands) {
  const count = island.type === "resource" ? 7 : island.type === "unique" ? 4 : 3;
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const d = 32 + Math.random() * (island.r - 48);
    resources.push({
      islandId: island.id,
      x: island.x + Math.cos(a) * d,
      y: island.y + Math.sin(a) * d,
      kind: island.type === "unique" ? "artifact" : Math.random() > 0.5 ? "metal" : "wood",
      taken: false,
    });
  }

  if (island.type === "enemy") {
    for (let i = 0; i < 4; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const d = 26 + Math.random() * (island.r - 58);
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
    x: 1180,
    y: 8200,
    angle: -0.55,
    speed: 0,
    hp: 100,
    maxHp: 100,
    speedLevel: 0,
    hullLevel: 0,
    cargoLevel: 0,
  },
  player: {
    x: 900,
    y: 8300,
    hp: 100,
    maxHp: 100,
  },
  inventory: {
    wood: 0,
    metal: 0,
    artifact: 0,
  },
  note: "Океан огромен: двигайтесь и открывайте острова по координатам.",
  noteTimer: 6,
  hitFlash: 0,
};

function shipMaxSpeed() {
  return 125 + state.ship.speedLevel * 30;
}

function cargoMax() {
  return 14 + state.ship.cargoLevel * 7;
}

function cargoUsed() {
  return state.inventory.wood + state.inventory.metal + state.inventory.artifact;
}

function setNote(text, ttl = 2.8) {
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
    if (d < 470 && !state.discovered.has(island.id)) {
      state.discovered.add(island.id);
      setNote(`Обнаружен остров: ${island.name}`, 2.2);
    }
    if (d < island.r + 120) state.visited.add(island.id);
  }
}

function dockAndRepair() {
  if (state.activeIslandId !== "base") return;
  const missing = state.ship.maxHp - state.ship.hp;
  if (missing <= 0) {
    setNote("Корпус в отличном состоянии.");
    return;
  }
  const cost = Math.ceil(missing * 0.55);
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
  setNote("Корабль полностью отремонтирован.");
}

function tryUpgrade(slot) {
  if (state.mode !== "ship" || state.activeIslandId !== "base") return;

  const options = {
    1: { key: "speedLevel", max: 4, w: 8, m: 6, a: 0, name: "Скорость" },
    2: { key: "hullLevel", max: 4, w: 5, m: 10, a: 0, name: "Прочность" },
    3: { key: "cargoLevel", max: 4, w: 10, m: 3, a: 1, name: "Трюм" },
  };

  const up = options[slot];
  if (!up) return;

  if (state.ship[up.key] >= up.max) {
    setNote(`${up.name} уже на максимуме.`);
    return;
  }

  const tier = state.ship[up.key] + 1;
  const costW = up.w * tier;
  const costM = up.m * tier;
  const costA = up.a * tier;

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
    state.ship.hp = Math.min(state.ship.maxHp, state.ship.hp + 26);
  }

  setNote(`${up.name} улучшена до ${state.ship[up.key]} ур.`);
}

function tryLandOrBoard() {
  if (state.mode === "ship") {
    if (Math.abs(state.ship.speed) > 20) {
      setNote("Сбросьте скорость почти до нуля для высадки.");
      return;
    }
    const island = getNearIsland(state.ship.x, state.ship.y, 28);
    if (!island) {
      setNote("Подойдите ближе к берегу острова.");
      return;
    }

    state.mode = "foot";
    state.activeIslandId = island.id;
    state.player.x = island.x;
    state.player.y = island.y;
    state.visited.add(island.id);
    setNote(`Высадка: ${island.name}.`);
  } else {
    const island = islandById(state.activeIslandId);
    const d = Math.hypot(state.player.x - state.ship.x, state.player.y - state.ship.y);
    if (d > island.r + 55) {
      setNote("Вернитесь к месту, где стоит корабль.");
      return;
    }

    state.mode = "ship";
    state.player.hp = state.player.maxHp;
    if (state.activeIslandId === "base") dockAndRepair();
    setNote("Вы снова на корабле.");
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

  if (!nearest || best > 30) {
    setNote("Ресурс слишком далеко для сбора.");
    return;
  }

  if (cargoUsed() >= cargoMax()) {
    setNote("Трюм переполнен. Нужна разгрузка на базе.");
    return;
  }

  nearest.taken = true;
  state.inventory[nearest.kind] += 1;
  setNote(`Собрано: ${nearest.kind}.`);
}

function handleShip(dt) {
  const turnRate = 2.15;
  const accel = 140;
  const reverse = 78;
  const drag = 0.975;

  if (keys.has("a") || keys.has("arrowleft")) state.ship.angle -= turnRate * dt;
  if (keys.has("d") || keys.has("arrowright")) state.ship.angle += turnRate * dt;
  if (keys.has("w") || keys.has("arrowup")) state.ship.speed += accel * dt;
  if (keys.has("s") || keys.has("arrowdown")) state.ship.speed -= reverse * dt;

  state.ship.speed = Math.max(-60, Math.min(shipMaxSpeed(), state.ship.speed));
  state.ship.speed *= drag;

  const nx = state.ship.x + Math.cos(state.ship.angle) * state.ship.speed * dt;
  const ny = state.ship.y + Math.sin(state.ship.angle) * state.ship.speed * dt;

  const hitIsland = getNearIsland(nx, ny, -14);
  if (hitIsland) {
    state.ship.speed *= -0.26;
    state.ship.hp -= 16 * dt;
    state.hitFlash = 1;
  } else {
    state.ship.x = nx;
    state.ship.y = ny;
  }

  if (state.ship.hp <= 0) {
    state.ship.hp = state.ship.maxHp;
    state.ship.x = 1180;
    state.ship.y = 8200;
    state.ship.speed = 0;
    state.inventory.wood = Math.max(0, state.inventory.wood - 5);
    state.inventory.metal = Math.max(0, state.inventory.metal - 5);
    setNote("Корабль восстановлен на базе. Часть груза утеряна.", 4.3);
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

  const speed = 138;
  state.player.x += mx * speed * dt;
  state.player.y += my * speed * dt;

  const dToCenter = Math.hypot(state.player.x - island.x, state.player.y - island.y);
  if (dToCenter > island.r - 10) {
    const ang = Math.atan2(state.player.y - island.y, state.player.x - island.x);
    state.player.x = island.x + Math.cos(ang) * (island.r - 10);
    state.player.y = island.y + Math.sin(ang) * (island.r - 10);
  }

  for (const enemy of enemies) {
    if (enemy.islandId !== island.id) continue;

    enemy.dir += (Math.random() - 0.5) * dt * 2.1;
    enemy.x += Math.cos(enemy.dir) * 44 * dt;
    enemy.y += Math.sin(enemy.dir) * 44 * dt;

    const edge = Math.hypot(enemy.x - island.x, enemy.y - island.y);
    if (edge > island.r - 16) {
      const ang = Math.atan2(enemy.y - island.y, enemy.x - island.x);
      enemy.x = island.x + Math.cos(ang) * (island.r - 16);
      enemy.y = island.y + Math.sin(ang) * (island.r - 16);
      enemy.dir += Math.PI * 0.8;
    }

    if (Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < 19) {
      state.player.hp -= 28 * dt;
      state.hitFlash = 1;
    }
  }

  if (state.player.hp <= 0) {
    state.player.hp = state.player.maxHp;
    state.player.x = island.x;
    state.player.y = island.y;
    state.inventory.wood = Math.max(0, state.inventory.wood - 1);
    state.inventory.metal = Math.max(0, state.inventory.metal - 1);
    setNote("Персонаж ранен и откатился к центру острова.");
  }
}

function update(dt) {
  if (state.noteTimer > 0) state.noteTimer -= dt;
  state.hitFlash = Math.max(0, state.hitFlash - dt * 2.2);

  if (state.mode === "ship") handleShip(dt);
  else handleFoot(dt);
}

function cameraOffset() {
  const target = state.mode === "ship" ? state.ship : state.player;
  return {
    x: target.x - canvas.width / 2,
    y: target.y - canvas.height / 2,
  };
}

function drawOcean(cam) {
  const sea = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sea.addColorStop(0, "#56dcff");
  sea.addColorStop(0.48, "#25bdf2");
  sea.addColorStop(1, "#0c87cb");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#abf6ff";
  ctx.lineWidth = 1.5;
  const step = 140;
  const ox = ((Math.floor(cam.x) % step) + step) % step;
  const oy = ((Math.floor(cam.y) % step) + step) % step;

  for (let x = -ox - step; x < canvas.width + step; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 80, canvas.height);
    ctx.stroke();
  }
  for (let y = -oy - step; y < canvas.height + step; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y + 35);
    ctx.stroke();
  }
  ctx.restore();
}

function islandColor(type) {
  if (type === "base") return "#ffd075";
  if (type === "enemy") return "#ff8b73";
  if (type === "unique") return "#c68cff";
  return "#89df6d";
}

function drawWorld(cam) {
  for (const island of islands) {
    if (!state.discovered.has(island.id)) continue;

    const sx = island.x - cam.x;
    const sy = island.y - cam.y;
    if (sx < -island.r - 100 || sx > canvas.width + island.r + 100) continue;
    if (sy < -island.r - 100 || sy > canvas.height + island.r + 100) continue;

    ctx.fillStyle = islandColor(island.type);
    ctx.beginPath();
    ctx.ellipse(sx, sy, island.r, island.r * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(20,55,35,0.2)";
    ctx.beginPath();
    ctx.ellipse(sx, sy + island.r * 0.2, island.r * 0.74, island.r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fffef8";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(island.name, sx - island.r * 0.46, sy - island.r - 10);
  }

  for (const res of resources) {
    if (res.taken || !state.discovered.has(res.islandId)) continue;

    const sx = res.x - cam.x;
    const sy = res.y - cam.y;
    if (sx < -30 || sx > canvas.width + 30 || sy < -30 || sy > canvas.height + 30) continue;

    ctx.fillStyle = res.kind === "wood" ? "#8c5a28" : res.kind === "metal" ? "#d4e5ff" : "#ffe27a";
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of enemies) {
    if (!state.discovered.has(enemy.islandId)) continue;

    const sx = enemy.x - cam.x;
    const sy = enemy.y - cam.y;
    if (sx < -30 || sx > canvas.width + 30 || sy < -30 || sy > canvas.height + 30) continue;

    ctx.fillStyle = "#ff4f6a";
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.mode === "ship") {
    const sx = state.ship.x - cam.x;
    const sy = state.ship.y - cam.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(state.ship.angle);
    ctx.fillStyle = "#8a4f22";
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-18, -12);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-18, 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f7d9ae";
    ctx.fillRect(-3, -16, 5, 13);
    ctx.fillStyle = "#ffefbf";
    ctx.beginPath();
    ctx.moveTo(2, -15);
    ctx.lineTo(15, -6);
    ctx.lineTo(2, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else {
    const sx = state.ship.x - cam.x;
    const sy = state.ship.y - cam.y;
    ctx.fillStyle = "#8a4f22";
    ctx.beginPath();
    ctx.arc(sx, sy, 14, 0, Math.PI * 2);
    ctx.fill();

    const px = state.player.x - cam.x;
    const py = state.player.y - cam.y;
    ctx.fillStyle = "#ffe0b8";
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
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
    if (near && best < 32) {
      ctx.strokeStyle = "#fff46f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(near.x - cam.x, near.y - cam.y, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.fillStyle = "rgba(0,18,44,0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const shipReveal = state.mode === "ship" ? 230 : 120;
  ctx.beginPath();
  ctx.arc(state.ship.x - cam.x, state.ship.y - cam.y, shipReveal, 0, Math.PI * 2);
  ctx.fill();

  for (const id of state.discovered) {
    const island = islandById(id);
    ctx.beginPath();
    ctx.arc(island.x - cam.x, island.y - cam.y, island.r + 80, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawUi() {
  ctx.fillStyle = "rgba(1,16,36,0.72)";
  ctx.fillRect(10, 10, 540, 174);
  ctx.fillStyle = "#f1fdff";
  ctx.font = "15px sans-serif";

  const mode = state.mode === "ship" ? "корабль" : `пешком (${islandById(state.activeIslandId).name})`;
  ctx.fillText(`Режим: ${mode}`, 20, 34);
  ctx.fillText(`Координаты корабля X:${Math.round(state.ship.x)} Y:${Math.round(state.ship.y)}`, 20, 56);
  ctx.fillText(`HP корабля: ${state.ship.hp.toFixed(0)}/${state.ship.maxHp} | HP персонажа: ${state.player.hp.toFixed(0)}/${state.player.maxHp}`, 20, 78);
  ctx.fillText(`Ресурсы: дерево ${state.inventory.wood}, металл ${state.inventory.metal}, артефакты ${state.inventory.artifact}`, 20, 100);
  ctx.fillText(`Трюм: ${cargoUsed()}/${cargoMax()} | Открыто островов: ${state.discovered.size}/${islands.length}`, 20, 122);
  ctx.fillText(`Улучшения: скорость ${state.ship.speedLevel}, корпус ${state.ship.hullLevel}, трюм ${state.ship.cargoLevel}`, 20, 144);
  ctx.fillText("Навигация: WASD, E - высадка/сбор, 1/2/3 - апгрейды на базе.", 20, 166);

  if (state.noteTimer > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(190, canvas.height - 45, 590, 30);
    ctx.fillStyle = "#f7fdff";
    ctx.fillText(state.note, 200, canvas.height - 25);
  }

  const chartW = 250;
  const chartH = 150;
  const chartX = canvas.width - chartW - 12;
  const chartY = 12;

  ctx.fillStyle = "rgba(3,20,42,0.78)";
  ctx.fillRect(chartX, chartY, chartW, chartH);
  ctx.strokeStyle = "#76d8ff";
  ctx.strokeRect(chartX, chartY, chartW, chartH);

  ctx.fillStyle = "#d5f3ff";
  ctx.font = "12px sans-serif";
  ctx.fillText("Навигационная карта (только открытое)", chartX + 8, chartY + 16);

  for (const island of islands) {
    if (!state.discovered.has(island.id)) continue;
    const x = chartX + (island.x / world.width) * chartW;
    const y = chartY + (island.y / world.height) * chartH;
    ctx.fillStyle = state.visited.has(island.id) ? "#ffe67d" : "#89dbff";
    ctx.beginPath();
    ctx.arc(x, y, island.type === "base" ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#ffb266";
  ctx.beginPath();
  ctx.arc(chartX + (state.ship.x / world.width) * chartW, chartY + (state.ship.y / world.height) * chartH, 3, 0, Math.PI * 2);
  ctx.fill();

  if (state.activeIslandId === "base" && state.mode === "ship") {
    ctx.fillStyle = "#ffe6bf";
    ctx.fillText("База: 1 скорость, 2 корпус, 3 трюм, E ремонт", 565, 28);
  }

  if (state.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,70,70,${0.22 * state.hitFlash})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function render() {
  const cam = cameraOffset();
  drawOcean(cam);
  drawWorld(cam);
  drawUi();
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);

  if (key === "e") {
    if (state.mode === "foot") gatherNearestResource();
    tryLandOrBoard();
  }

  if (key === "1" || key === "2" || key === "3") {
    tryUpgrade(Number(key));
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
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
