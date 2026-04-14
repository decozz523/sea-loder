const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const controlProfileBadge = document.getElementById("control-profile-badge");
const mobileControls = document.getElementById("mobile-controls");
const actionButtons = mobileControls ? Array.from(mobileControls.querySelectorAll("button")) : [];

const world = {
  width: 14000,
  height: 10000,
};

const keys = new Set();
const touchActions = new Set();
const resources = [];
const enemies = [];
const krakens = [];

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

const canvasRatio = 16 / 9;
let uiScale = 1;

function isMobileProfile() {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 900;
}

function updateControlProfileUi() {
  if (!controlProfileBadge || !mobileControls) return;
  const mobile = isMobileProfile();
  controlProfileBadge.textContent = mobile ? "Автонастройка: Телефон" : "Автонастройка: ПК";
  mobileControls.style.display = mobile ? "flex" : "none";
}

function resizeCanvas() {
  const parentWidth = canvas.parentElement.clientWidth;
  const maxHeight = Math.min(window.innerHeight * 0.72, parentWidth / canvasRatio);
  const logicalWidth = Math.max(640, Math.round(maxHeight * canvasRatio));
  const logicalHeight = Math.round(logicalWidth / canvasRatio);
  canvas.width = logicalWidth;
  canvas.height = logicalHeight;
  uiScale = Math.max(0.8, Math.min(1.08, canvas.width / 960));
}

function hasAction(name) {
  return keys.has(name) || touchActions.has(name);
}

function triggerPrimaryAction() {
  if (state.mode === "foot") gatherNearestResource();
  tryLandOrBoard();
}

function triggerUpgrade(slot) {
  tryUpgrade(slot);
}

function createIslands() {
  const generated = [{ id: "base", x: 900, y: 8300, r: 210, type: "base", name: "База" }];
  const totalIslands = 11;
  const typePool = ["resource", "resource", "resource", "enemy", "enemy", "unique"];

  let attempts = 0;
  while (generated.length < totalIslands && attempts < 1200) {
    attempts += 1;
    const r = randomRange(145, 235);
    const x = randomRange(1200, world.width - 300);
    const y = randomRange(400, world.height - 300);

    const tooClose = generated.some((island) => Math.hypot(island.x - x, island.y - y) < island.r + r + 480);
    if (tooClose) continue;

    const type = typePool[Math.floor(Math.random() * typePool.length)];
    const id = `i${generated.length}`;
    generated.push({
      id,
      x: Math.round(x),
      y: Math.round(y),
      r: Math.round(r),
      type,
      name: `${type === "unique" ? "Реликт" : type === "enemy" ? "Опасный" : "Дикий"} (${Math.round(x)},${Math.round(y)})`,
    });
  }

  return generated;
}

const islands = createIslands();

function islandById(id) {
  return islands.find((i) => i.id === id);
}

for (const island of islands) {
  const count = island.type === "resource" ? 8 : island.type === "unique" ? 5 : 3;
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
  note: "Океан и острова генерируются рандомно при каждом запуске.",
  noteTimer: 6,
  hitFlash: 0,
  krakenCooldown: 11,
  krakenEscapes: 0,
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
      setNote(`Обнаружен остров: ${island.name}`, 2.3);
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

function spawnKraken() {
  const angle = Math.random() * Math.PI * 2;
  const distance = randomRange(500, 760);
  const x = state.ship.x + Math.cos(angle) * distance;
  const y = state.ship.y + Math.sin(angle) * distance;

  krakens.push({
    x,
    y,
    vx: randomRange(-25, 25),
    vy: randomRange(-25, 25),
    chasing: false,
    life: randomRange(18, 32),
    escapeMeter: 0,
  });

  setNote("⚠ Кракен замечен! Есть шанс убежать на скорости.", 3.6);
}

function updateKrakens(dt) {
  if (state.mode !== "ship") return;

  state.krakenCooldown -= dt;
  if (state.krakenCooldown <= 0) {
    const spawnChance = 0.18 + Math.min(0.24, state.ship.speed / 250);
    if (Math.random() < spawnChance) spawnKraken();
    state.krakenCooldown = randomRange(20, 40);
  }

  for (let i = krakens.length - 1; i >= 0; i -= 1) {
    const k = krakens[i];
    k.life -= dt;
    if (k.life <= 0) {
      krakens.splice(i, 1);
      continue;
    }

    const dx = state.ship.x - k.x;
    const dy = state.ship.y - k.y;
    const d = Math.hypot(dx, dy);

    if (!k.chasing && d < 380) {
      k.chasing = true;
      setNote("Кракен атакует корабль! Жми газ и уводи его.", 2.8);
    }

    if (k.chasing) {
      k.vx += (dx / (d || 1)) * 95 * dt;
      k.vy += (dy / (d || 1)) * 95 * dt;

      if (d < 110) {
        state.ship.hp -= 24 * dt;
        state.ship.speed *= 0.986;
        state.hitFlash = 1;
      }

      if (d > 280 && state.ship.speed > 95) {
        k.escapeMeter += dt;
      } else {
        k.escapeMeter = Math.max(0, k.escapeMeter - dt * 0.6);
      }

      if (k.escapeMeter > 3.5) {
        krakens.splice(i, 1);
        state.krakenEscapes += 1;
        setNote("Вы ушли от кракена!", 2.2);
        continue;
      }
    }

    const speed = Math.hypot(k.vx, k.vy);
    const maxSpeed = k.chasing ? 115 : 55;
    if (speed > maxSpeed) {
      k.vx = (k.vx / speed) * maxSpeed;
      k.vy = (k.vy / speed) * maxSpeed;
    }

    k.x += k.vx * dt;
    k.y += k.vy * dt;
    k.vx *= 0.985;
    k.vy *= 0.985;

    if (Math.hypot(k.x - state.ship.x, k.y - state.ship.y) > 1300) {
      krakens.splice(i, 1);
    }
  }
}

function handleShip(dt) {
  const turnRate = 2.15;
  const accel = 140;
  const reverse = 78;
  const drag = 0.975;

  if (hasAction("a") || hasAction("arrowleft") || hasAction("left")) state.ship.angle -= turnRate * dt;
  if (hasAction("d") || hasAction("arrowright") || hasAction("right")) state.ship.angle += turnRate * dt;
  if (hasAction("w") || hasAction("arrowup") || hasAction("up")) state.ship.speed += accel * dt;
  if (hasAction("s") || hasAction("arrowdown") || hasAction("down")) state.ship.speed -= reverse * dt;

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

  updateKrakens(dt);

  if (state.ship.hp <= 0) {
    state.ship.hp = state.ship.maxHp;
    state.ship.x = 1180;
    state.ship.y = 8200;
    state.ship.speed = 0;
    state.inventory.wood = Math.max(0, state.inventory.wood - 5);
    state.inventory.metal = Math.max(0, state.inventory.metal - 5);
    krakens.length = 0;
    setNote("Корабль уничтожен и восстановлен на базе. Груз частично утерян.", 4.3);
  }

  updateDiscovery();
}

function handleFoot(dt) {
  const island = islandById(state.activeIslandId);
  let mx = 0;
  let my = 0;

  if (hasAction("a") || hasAction("arrowleft") || hasAction("left")) mx -= 1;
  if (hasAction("d") || hasAction("arrowright") || hasAction("right")) mx += 1;
  if (hasAction("w") || hasAction("arrowup") || hasAction("up")) my -= 1;
  if (hasAction("s") || hasAction("arrowdown") || hasAction("down")) my += 1;

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
  sea.addColorStop(0, "#67e7ff");
  sea.addColorStop(0.5, "#2ec8f8");
  sea.addColorStop(1, "#0e8dd0");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const step = 140;
  const ox = ((Math.floor(cam.x) % step) + step) % step;
  const oy = ((Math.floor(cam.y) % step) + step) % step;

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#bdf7ff";
  ctx.lineWidth = 1.5;

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

  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 18; i += 1) {
    const sx = (i * 67 + ox * 0.7) % (canvas.width + 50) - 25;
    const sy = (i * 43 + oy * 0.9) % (canvas.height + 40) - 20;
    ctx.fillStyle = i % 2 ? "#dfffff" : "#9fefff";
    ctx.fillRect(sx, sy, 18, 2);
  }
  ctx.restore();
}

function islandColor(type) {
  if (type === "base") return "#ffd075";
  if (type === "enemy") return "#ff8b73";
  if (type === "unique") return "#c68cff";
  return "#89df6d";
}

function drawKraken(x, y, chasing) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = chasing ? "#9a2eff" : "#7f2ec7";
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = chasing ? "#ff9fff" : "#bf90ff";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
    ctx.lineTo(Math.cos(angle) * 24, Math.sin(angle) * 24);
    ctx.stroke();
  }
  ctx.restore();
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
    ctx.fillText(island.name, sx - island.r * 0.5, sy - island.r - 10);
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

  for (const k of krakens) {
    const sx = k.x - cam.x;
    const sy = k.y - cam.y;
    if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) continue;
    drawKraken(sx, sy, k.chasing);
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

function drawBar(x, y, w, h, ratio, color, bg = "rgba(255,255,255,0.14)") {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, (w - 4) * Math.max(0, Math.min(1, ratio)), h - 4);
}

function drawUi() {
  const s = uiScale;
  const panelX = 10 * s;
  const panelY = 10 * s;
  const panelW = 560 * s;
  const panelH = 196 * s;

  const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  panelGrad.addColorStop(0, "rgba(4, 30, 66, 0.84)");
  panelGrad.addColorStop(1, "rgba(2, 18, 44, 0.72)");
  ctx.fillStyle = panelGrad;
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "rgba(133, 225, 255, 0.75)";
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  const mode = state.mode === "ship" ? "🚢 корабль" : `🧍 пешком (${islandById(state.activeIslandId).name})`;

  ctx.fillStyle = "#f1fdff";
  ctx.font = `bold ${Math.round(16 * s)}px sans-serif`;
  ctx.fillText(`Режим: ${mode}`, 22 * s, 34 * s);

  ctx.font = `${Math.round(14 * s)}px sans-serif`;
  ctx.fillStyle = "#dcf8ff";
  ctx.fillText(`Координаты корабля: X ${Math.round(state.ship.x)} | Y ${Math.round(state.ship.y)}`, 22 * s, 56 * s);
  ctx.fillText(`Скорость: ${Math.abs(state.ship.speed).toFixed(1)} узл.`, 22 * s, 76 * s);

  drawBar(22 * s, 88 * s, 240 * s, 14 * s, state.ship.hp / state.ship.maxHp, "#ff7e6f");
  drawBar(22 * s, 112 * s, 240 * s, 14 * s, state.player.hp / state.player.maxHp, "#8de36b");
  drawBar(22 * s, 136 * s, 240 * s, 14 * s, cargoUsed() / cargoMax(), "#ffd56b");

  ctx.fillStyle = "#f6f9ff";
  ctx.font = `${Math.round(12 * s)}px sans-serif`;
  ctx.fillText(`Корабль HP ${state.ship.hp.toFixed(0)}/${state.ship.maxHp}`, 270 * s, 99 * s);
  ctx.fillText(`Персонаж HP ${state.player.hp.toFixed(0)}/${state.player.maxHp}`, 270 * s, 123 * s);
  ctx.fillText(`Трюм ${cargoUsed()}/${cargoMax()} | Кракены рядом: ${krakens.length}`, 270 * s, 147 * s);

  ctx.fillStyle = "#d2f7ff";
  ctx.fillText(`Ресурсы: 🌲 ${state.inventory.wood}   ⚙ ${state.inventory.metal}   ✨ ${state.inventory.artifact}`, 22 * s, 170 * s);
  ctx.fillText(`Апгрейды: ⚡ ${state.ship.speedLevel}   🛡 ${state.ship.hullLevel}   📦 ${state.ship.cargoLevel} | Побегов от кракена: ${state.krakenEscapes}`, 22 * s, 188 * s);

  if (state.noteTimer > 0) {
    ctx.fillStyle = "rgba(2, 20, 40, 0.75)";
    ctx.fillRect(170 * s, canvas.height - 48 * s, 620 * s, 34 * s);
    ctx.strokeStyle = "rgba(124, 218, 255, 0.8)";
    ctx.strokeRect(170 * s, canvas.height - 48 * s, 620 * s, 34 * s);
    ctx.fillStyle = "#f7fdff";
    ctx.font = `${Math.round(14 * s)}px sans-serif`;
    ctx.fillText(state.note, 184 * s, canvas.height - 26 * s);
  }

  const chartW = 280 * s;
  const chartH = 170 * s;
  const chartX = canvas.width - chartW - 12 * s;
  const chartY = 12 * s;

  const mapGrad = ctx.createLinearGradient(chartX, chartY, chartX, chartY + chartH);
  mapGrad.addColorStop(0, "rgba(6, 28, 58, 0.84)");
  mapGrad.addColorStop(1, "rgba(2, 16, 36, 0.74)");
  ctx.fillStyle = mapGrad;
  ctx.fillRect(chartX, chartY, chartW, chartH);
  ctx.strokeStyle = "#79ddff";
  ctx.strokeRect(chartX, chartY, chartW, chartH);

  ctx.fillStyle = "#d5f3ff";
  ctx.font = `${Math.round(12 * s)}px sans-serif`;
  ctx.fillText("🧭 Навигационная карта (только открытое)", chartX + 8 * s, chartY + 16 * s);

  for (let gx = 0; gx <= 4; gx += 1) {
    const x = chartX + (gx / 4) * chartW;
    ctx.strokeStyle = "rgba(130, 207, 236, 0.15)";
    ctx.beginPath();
    ctx.moveTo(x, chartY + 20 * s);
    ctx.lineTo(x, chartY + chartH);
    ctx.stroke();
  }

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
  ctx.arc(chartX + (state.ship.x / world.width) * chartW, chartY + (state.ship.y / world.height) * chartH, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();

  if (state.activeIslandId === "base" && state.mode === "ship") {
    ctx.fillStyle = "#ffe6bf";
    ctx.font = `${Math.round(13 * s)}px sans-serif`;
    ctx.fillText("База: 1 скорость · 2 корпус · 3 трюм · E ремонт", 582 * s, 204 * s);
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
    triggerPrimaryAction();
  }

  if (key === "1" || key === "2" || key === "3") {
    triggerUpgrade(Number(key));
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

function bindTouchControl(btn, action) {
  const press = (event) => {
    event.preventDefault();
    touchActions.add(action);
    btn.classList.add("is-active");
    if (action === "interact") triggerPrimaryAction();
    if (action === "upgrade1") triggerUpgrade(1);
    if (action === "upgrade2") triggerUpgrade(2);
    if (action === "upgrade3") triggerUpgrade(3);
  };

  const release = (event) => {
    event.preventDefault();
    touchActions.delete(action);
    btn.classList.remove("is-active");
  };

  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchend", release, { passive: false });
  btn.addEventListener("touchcancel", release, { passive: false });
  btn.addEventListener("mousedown", press);
  btn.addEventListener("mouseup", release);
  btn.addEventListener("mouseleave", release);
}

for (const btn of actionButtons) {
  bindTouchControl(btn, btn.dataset.action);
}

window.addEventListener("resize", () => {
  updateControlProfileUi();
  resizeCanvas();
});

updateControlProfileUi();
resizeCanvas();

let previous = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - previous) / 1000);
  previous = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
