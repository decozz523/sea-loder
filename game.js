diff --git a/game.js b/game.js
index 1992907208b9d4821ccd0fb7ecfea3396e130515..4ad6de19dcdd0df36a9ecf6de6c430eaca86a5b8 100644
--- a/game.js
+++ b/game.js
@@ -1,478 +1,637 @@
 const canvas = document.getElementById("game");
 const ctx = canvas.getContext("2d");
 
 const world = {
-  width: canvas.width,
-  height: canvas.height,
-  tilt: 0.6,
+  width: 14000,
+  height: 10000,
 };
 
 const keys = new Set();
-const pressed = new Set();
+
+const islands = [
+  { id: "base", x: 900, y: 8300, r: 210, type: "base", name: "База (900,8300)" },
+  { id: "i1", x: 2200, y: 7300, r: 180, type: "resource", name: "Лагуна (2200,7300)" },
+  { id: "i2", x: 3400, y: 5700, r: 220, type: "enemy", name: "Клык (3400,5700)" },
+  { id: "i3", x: 4700, y: 8100, r: 170, type: "resource", name: "Пальмы (4700,8100)" },
+  { id: "i4", x: 6000, y: 6800, r: 200, type: "enemy", name: "Корсар (6000,6800)" },
+  { id: "i5", x: 7200, y: 5000, r: 190, type: "resource", name: "Штиль (7200,5000)" },
+  { id: "i6", x: 8600, y: 7600, r: 230, type: "unique", name: "Монолит (8600,7600)" },
+  { id: "i7", x: 9900, y: 4200, r: 170, type: "resource", name: "Риф (9900,4200)" },
+  { id: "i8", x: 11300, y: 6100, r: 210, type: "enemy", name: "Разлом (11300,6100)" },
+  { id: "i9", x: 12600, y: 3100, r: 150, type: "unique", name: "Обелиск (12600,3100)" },
+];
+
+const resources = [];
+const enemies = [];
+
+function islandById(id) {
+  return islands.find((i) => i.id === id);
+}
+
+for (const island of islands) {
+  const count = island.type === "resource" ? 7 : island.type === "unique" ? 4 : 3;
+  for (let i = 0; i < count; i += 1) {
+    const a = Math.random() * Math.PI * 2;
+    const d = 32 + Math.random() * (island.r - 48);
+    resources.push({
+      islandId: island.id,
+      x: island.x + Math.cos(a) * d,
+      y: island.y + Math.sin(a) * d,
+      kind: island.type === "unique" ? "artifact" : Math.random() > 0.5 ? "metal" : "wood",
+      taken: false,
+    });
+  }
+
+  if (island.type === "enemy") {
+    for (let i = 0; i < 4; i += 1) {
+      const a = Math.random() * Math.PI * 2;
+      const d = 26 + Math.random() * (island.r - 58);
+      enemies.push({
+        islandId: island.id,
+        x: island.x + Math.cos(a) * d,
+        y: island.y + Math.sin(a) * d,
+        dir: Math.random() * Math.PI * 2,
+      });
+    }
+  }
+}
 
 const state = {
-  cash: 60,
-  fish: 0,
-  hp: 100,
-  maxHp: 100,
-  boat: {
-    x: 180,
-    y: 330,
-    vx: 0,
-    vy: 0,
-    baseSpeed: 115,
+  discovered: new Set(["base"]),
+  visited: new Set(["base"]),
+  mode: "ship",
+  activeIslandId: "base",
+  ship: {
+    x: 1180,
+    y: 8200,
+    angle: -0.55,
+    speed: 0,
+    hp: 100,
+    maxHp: 100,
     speedLevel: 0,
     hullLevel: 0,
-    rodLevel: 0,
-    storageLevel: 0,
-    storageBase: 6,
-  },
-  threats: [],
-  msg: "Отправляйся в рыболовную зону.",
-  msgTimer: 5,
-  dangerFlash: 0,
-  fishCooldown: 0,
-  fishingProgress: 0,
-  shopOpen: false,
-  gameOver: false,
-};
-
-const zones = {
-  shop: { x: 70, y: 270, w: 170, h: 160, title: "Причал / магазин" },
-  fishing: { x: 540, y: 130, w: 320, h: 260, title: "Зона ловли" },
-};
-
-const upgrades = [
-  {
-    key: "speedLevel",
-    name: "Двигатель",
-    baseCost: 45,
-    max: 5,
-    desc: "+10% к скорости лодки",
-    apply: () => {},
+    cargoLevel: 0,
   },
-  {
-    key: "hullLevel",
-    name: "Корпус",
-    baseCost: 55,
-    max: 5,
-    desc: "+18 макс. прочности",
-    apply: () => {
-      state.maxHp = 100 + state.boat.hullLevel * 18;
-      state.hp = Math.min(state.maxHp, state.hp + 14);
-    },
+  player: {
+    x: 900,
+    y: 8300,
+    hp: 100,
+    maxHp: 100,
   },
-  {
-    key: "rodLevel",
-    name: "Снасти",
-    baseCost: 40,
-    max: 5,
-    desc: "Быстрее и выгоднее ловля",
-    apply: () => {},
+  inventory: {
+    wood: 0,
+    metal: 0,
+    artifact: 0,
   },
-  {
-    key: "storageLevel",
-    name: "Трюм",
-    baseCost: 35,
-    max: 5,
-    desc: "+2 к вместимости",
-    apply: () => {},
-  },
-];
+  note: "Океан огромен: двигайтесь и открывайте острова по координатам.",
+  noteTimer: 6,
+  hitFlash: 0,
+};
 
-function storageLimit() {
-  return state.boat.storageBase + state.boat.storageLevel * 2;
+function shipMaxSpeed() {
+  return 125 + state.ship.speedLevel * 30;
 }
 
-function speedMultiplier() {
-  return 1 + state.boat.speedLevel * 0.1;
+function cargoMax() {
+  return 14 + state.ship.cargoLevel * 7;
 }
 
-function rodMultiplier() {
-  return 1 + state.boat.rodLevel * 0.18;
+function cargoUsed() {
+  return state.inventory.wood + state.inventory.metal + state.inventory.artifact;
 }
 
-function notify(text, seconds = 2.2) {
-  state.msg = text;
-  state.msgTimer = seconds;
+function setNote(text, ttl = 2.8) {
+  state.note = text;
+  state.noteTimer = ttl;
 }
 
-function addThreats() {
-  const safe = zones.shop;
-  for (let i = 0; i < 3; i += 1) {
-    state.threats.push({
-      kind: "log",
-      x: 360 + Math.random() * 500,
-      y: 80 + Math.random() * 380,
-      vx: (Math.random() > 0.5 ? 1 : -1) * (30 + Math.random() * 40),
-      vy: (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 35),
-      r: 18,
-    });
+function getNearIsland(x, y, extra = 0) {
+  for (const island of islands) {
+    if (Math.hypot(x - island.x, y - island.y) <= island.r + extra) return island;
   }
-  for (let i = 0; i < 2; i += 1) {
-    state.threats.push({
-      kind: "whirlpool",
-      x: safe.x + safe.w + 130 + Math.random() * 450,
-      y: 90 + Math.random() * 380,
-      strength: 26 + Math.random() * 12,
-      r: 32,
-    });
+  return null;
+}
+
+function updateDiscovery() {
+  const sx = state.ship.x;
+  const sy = state.ship.y;
+  for (const island of islands) {
+    const d = Math.hypot(sx - island.x, sy - island.y);
+    if (d < 470 && !state.discovered.has(island.id)) {
+      state.discovered.add(island.id);
+      setNote(`Обнаружен остров: ${island.name}`, 2.2);
+    }
+    if (d < island.r + 120) state.visited.add(island.id);
   }
-  state.threats.push({
-    kind: "storm",
-    x: 430,
-    y: 55,
-    w: 240,
-    h: 140,
-    pulse: 0,
-  });
 }
 
-function inZone(z, x = state.boat.x, y = state.boat.y) {
-  return x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h;
+function dockAndRepair() {
+  if (state.activeIslandId !== "base") return;
+  const missing = state.ship.maxHp - state.ship.hp;
+  if (missing <= 0) {
+    setNote("Корпус в отличном состоянии.");
+    return;
+  }
+  const cost = Math.ceil(missing * 0.55);
+  const available = state.inventory.wood + state.inventory.metal;
+  if (available < cost) {
+    setNote(`Не хватает ресурсов для ремонта (${cost}).`);
+    return;
+  }
+  let left = cost;
+  while (left > 0 && state.inventory.wood > 0) {
+    state.inventory.wood -= 1;
+    left -= 1;
+  }
+  while (left > 0 && state.inventory.metal > 0) {
+    state.inventory.metal -= 1;
+    left -= 1;
+  }
+  state.ship.hp = state.ship.maxHp;
+  setNote("Корабль полностью отремонтирован.");
 }
 
-function handleShopAction() {
-  if (!inZone(zones.shop)) return;
+function tryUpgrade(slot) {
+  if (state.mode !== "ship" || state.activeIslandId !== "base") return;
+
+  const options = {
+    1: { key: "speedLevel", max: 4, w: 8, m: 6, a: 0, name: "Скорость" },
+    2: { key: "hullLevel", max: 4, w: 5, m: 10, a: 0, name: "Прочность" },
+    3: { key: "cargoLevel", max: 4, w: 10, m: 3, a: 1, name: "Трюм" },
+  };
+
+  const up = options[slot];
+  if (!up) return;
+
+  if (state.ship[up.key] >= up.max) {
+    setNote(`${up.name} уже на максимуме.`);
+    return;
+  }
 
-  if (state.fish > 0) {
-    const gain = Math.round(state.fish * (18 + state.boat.rodLevel * 5));
-    state.cash += gain;
-    notify(`Продано рыбы: +${gain} монет.`);
-    state.fish = 0;
+  const tier = state.ship[up.key] + 1;
+  const costW = up.w * tier;
+  const costM = up.m * tier;
+  const costA = up.a * tier;
+
+  if (
+    state.inventory.wood < costW ||
+    state.inventory.metal < costM ||
+    state.inventory.artifact < costA
+  ) {
+    setNote(`Нужно: дерево ${costW}, металл ${costM}, артефакты ${costA}.`);
     return;
   }
 
-  for (const up of upgrades) {
-    const level = state.boat[up.key];
-    if (level >= up.max) continue;
-    const price = up.baseCost + level * 30;
-    if (state.cash >= price) {
-      state.cash -= price;
-      state.boat[up.key] += 1;
-      up.apply();
-      notify(`${up.name} улучшен до ${state.boat[up.key]} уровня.`);
+  state.inventory.wood -= costW;
+  state.inventory.metal -= costM;
+  state.inventory.artifact -= costA;
+  state.ship[up.key] += 1;
+
+  if (up.key === "hullLevel") {
+    state.ship.maxHp = 100 + state.ship.hullLevel * 35;
+    state.ship.hp = Math.min(state.ship.maxHp, state.ship.hp + 26);
+  }
+
+  setNote(`${up.name} улучшена до ${state.ship[up.key]} ур.`);
+}
+
+function tryLandOrBoard() {
+  if (state.mode === "ship") {
+    if (Math.abs(state.ship.speed) > 20) {
+      setNote("Сбросьте скорость почти до нуля для высадки.");
+      return;
+    }
+    const island = getNearIsland(state.ship.x, state.ship.y, 28);
+    if (!island) {
+      setNote("Подойдите ближе к берегу острова.");
+      return;
+    }
+
+    state.mode = "foot";
+    state.activeIslandId = island.id;
+    state.player.x = island.x;
+    state.player.y = island.y;
+    state.visited.add(island.id);
+    setNote(`Высадка: ${island.name}.`);
+  } else {
+    const island = islandById(state.activeIslandId);
+    const d = Math.hypot(state.player.x - state.ship.x, state.player.y - state.ship.y);
+    if (d > island.r + 55) {
+      setNote("Вернитесь к месту, где стоит корабль.");
       return;
     }
-  }
 
-  notify("Недостаточно денег или всё улучшено.");
+    state.mode = "ship";
+    state.player.hp = state.player.maxHp;
+    if (state.activeIslandId === "base") dockAndRepair();
+    setNote("Вы снова на корабле.");
+  }
 }
 
-function handleFishingAction() {
-  if (!inZone(zones.fishing)) {
-    notify("Ловить можно только в рыболовной зоне.");
+function gatherNearestResource() {
+  if (state.mode !== "foot") return;
+
+  const island = islandById(state.activeIslandId);
+  let nearest = null;
+  let best = Infinity;
+
+  for (const res of resources) {
+    if (res.taken || res.islandId !== island.id) continue;
+    const d = Math.hypot(res.x - state.player.x, res.y - state.player.y);
+    if (d < best) {
+      best = d;
+      nearest = res;
+    }
+  }
+
+  if (!nearest || best > 30) {
+    setNote("Ресурс слишком далеко для сбора.");
     return;
   }
 
-  if (state.fish >= storageLimit()) {
-    notify("Трюм полон! Вернись на причал.");
+  if (cargoUsed() >= cargoMax()) {
+    setNote("Трюм переполнен. Нужна разгрузка на базе.");
     return;
   }
 
-  if (state.fishCooldown > 0) return;
-  state.fishingProgress = 0.3;
-  const chance = 0.6 + state.boat.rodLevel * 0.08;
-  const caught = Math.random() < chance ? 1 : 0;
-  if (caught) {
-    state.fish += 1;
-    notify("Поймал рыбу!", 1.4);
+  nearest.taken = true;
+  state.inventory[nearest.kind] += 1;
+  setNote(`Собрано: ${nearest.kind}.`);
+}
+
+function handleShip(dt) {
+  const turnRate = 2.15;
+  const accel = 140;
+  const reverse = 78;
+  const drag = 0.975;
+
+  if (keys.has("a") || keys.has("arrowleft")) state.ship.angle -= turnRate * dt;
+  if (keys.has("d") || keys.has("arrowright")) state.ship.angle += turnRate * dt;
+  if (keys.has("w") || keys.has("arrowup")) state.ship.speed += accel * dt;
+  if (keys.has("s") || keys.has("arrowdown")) state.ship.speed -= reverse * dt;
+
+  state.ship.speed = Math.max(-60, Math.min(shipMaxSpeed(), state.ship.speed));
+  state.ship.speed *= drag;
+
+  const nx = state.ship.x + Math.cos(state.ship.angle) * state.ship.speed * dt;
+  const ny = state.ship.y + Math.sin(state.ship.angle) * state.ship.speed * dt;
+
+  const hitIsland = getNearIsland(nx, ny, -14);
+  if (hitIsland) {
+    state.ship.speed *= -0.26;
+    state.ship.hp -= 16 * dt;
+    state.hitFlash = 1;
   } else {
-    notify("Рыба сорвалась.", 1.2);
+    state.ship.x = nx;
+    state.ship.y = ny;
+  }
+
+  if (state.ship.hp <= 0) {
+    state.ship.hp = state.ship.maxHp;
+    state.ship.x = 1180;
+    state.ship.y = 8200;
+    state.ship.speed = 0;
+    state.inventory.wood = Math.max(0, state.inventory.wood - 5);
+    state.inventory.metal = Math.max(0, state.inventory.metal - 5);
+    setNote("Корабль восстановлен на базе. Часть груза утеряна.", 4.3);
   }
-  state.fishCooldown = 0.65 / rodMultiplier();
-}
 
-function respawn() {
-  state.boat.x = 170;
-  state.boat.y = 330;
-  state.boat.vx = 0;
-  state.boat.vy = 0;
-  const penalty = Math.min(state.cash, 35);
-  state.cash -= penalty;
-  state.fish = Math.max(0, state.fish - 2);
-  state.hp = state.maxHp;
-  state.gameOver = false;
-  notify(`Лодка восстановлена. Штраф ${penalty} монет.`);
+  updateDiscovery();
 }
 
-function update(dt) {
-  if (state.msgTimer > 0) state.msgTimer -= dt;
-  state.dangerFlash = Math.max(0, state.dangerFlash - dt * 1.5);
-  state.fishCooldown = Math.max(0, state.fishCooldown - dt);
-  state.fishingProgress = Math.max(0, state.fishingProgress - dt * 1.3);
-
-  if (state.gameOver) return;
-
-  const b = state.boat;
-  const accel = 260 * speedMultiplier();
-
-  let ix = 0;
-  let iy = 0;
-
-  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) ix -= 1;
-  if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) ix += 1;
-  if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) iy -= 1;
-  if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) iy += 1;
-
-  const len = Math.hypot(ix, iy) || 1;
-  ix /= len;
-  iy /= len;
-
-  b.vx += ix * accel * dt;
-  b.vy += iy * accel * dt;
-
-  const maxSpeed = b.baseSpeed * speedMultiplier();
-  const spd = Math.hypot(b.vx, b.vy);
-  if (spd > maxSpeed) {
-    b.vx = (b.vx / spd) * maxSpeed;
-    b.vy = (b.vy / spd) * maxSpeed;
-  }
-
-  b.vx *= 0.91;
-  b.vy *= 0.91;
-
-  for (const t of state.threats) {
-    if (t.kind === "log") {
-      t.x += t.vx * dt;
-      t.y += t.vy * dt;
-      if (t.x < 280 || t.x > world.width - 30) t.vx *= -1;
-      if (t.y < 45 || t.y > world.height - 40) t.vy *= -1;
-
-      const d = Math.hypot(t.x - b.x, t.y - b.y);
-      if (d < t.r + 12) {
-        b.vx += (b.x - t.x) * 2.5 * dt;
-        b.vy += (b.y - t.y) * 2.5 * dt;
-        state.hp -= 12 * dt;
-        state.dangerFlash = 1;
-      }
-    }
+function handleFoot(dt) {
+  const island = islandById(state.activeIslandId);
+  let mx = 0;
+  let my = 0;
+
+  if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
+  if (keys.has("d") || keys.has("arrowright")) mx += 1;
+  if (keys.has("w") || keys.has("arrowup")) my -= 1;
+  if (keys.has("s") || keys.has("arrowdown")) my += 1;
+
+  const len = Math.hypot(mx, my) || 1;
+  mx /= len;
+  my /= len;
+
+  const speed = 138;
+  state.player.x += mx * speed * dt;
+  state.player.y += my * speed * dt;
+
+  const dToCenter = Math.hypot(state.player.x - island.x, state.player.y - island.y);
+  if (dToCenter > island.r - 10) {
+    const ang = Math.atan2(state.player.y - island.y, state.player.x - island.x);
+    state.player.x = island.x + Math.cos(ang) * (island.r - 10);
+    state.player.y = island.y + Math.sin(ang) * (island.r - 10);
+  }
 
-    if (t.kind === "whirlpool") {
-      const dx = t.x - b.x;
-      const dy = t.y - b.y;
-      const d = Math.hypot(dx, dy);
-      if (d < t.r * 2.3) {
-        b.vx += (dx / (d || 1)) * t.strength * dt;
-        b.vy += (dy / (d || 1)) * t.strength * dt;
-        state.hp -= 8 * dt;
-        state.dangerFlash = 0.9;
-      }
+  for (const enemy of enemies) {
+    if (enemy.islandId !== island.id) continue;
+
+    enemy.dir += (Math.random() - 0.5) * dt * 2.1;
+    enemy.x += Math.cos(enemy.dir) * 44 * dt;
+    enemy.y += Math.sin(enemy.dir) * 44 * dt;
+
+    const edge = Math.hypot(enemy.x - island.x, enemy.y - island.y);
+    if (edge > island.r - 16) {
+      const ang = Math.atan2(enemy.y - island.y, enemy.x - island.x);
+      enemy.x = island.x + Math.cos(ang) * (island.r - 16);
+      enemy.y = island.y + Math.sin(ang) * (island.r - 16);
+      enemy.dir += Math.PI * 0.8;
     }
 
-    if (t.kind === "storm") {
-      t.pulse += dt;
-      if (inZone(t, b.x, b.y)) {
-        b.vx *= 0.985;
-        b.vy *= 0.985;
-        state.hp -= (6 + Math.sin(t.pulse * 6) * 2) * dt;
-        state.dangerFlash = 0.8;
-      }
+    if (Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < 19) {
+      state.player.hp -= 28 * dt;
+      state.hitFlash = 1;
     }
   }
 
-  b.x += b.vx * dt;
-  b.y += b.vy * dt;
+  if (state.player.hp <= 0) {
+    state.player.hp = state.player.maxHp;
+    state.player.x = island.x;
+    state.player.y = island.y;
+    state.inventory.wood = Math.max(0, state.inventory.wood - 1);
+    state.inventory.metal = Math.max(0, state.inventory.metal - 1);
+    setNote("Персонаж ранен и откатился к центру острова.");
+  }
+}
 
-  b.x = Math.max(25, Math.min(world.width - 25, b.x));
-  b.y = Math.max(35, Math.min(world.height - 25, b.y));
+function update(dt) {
+  if (state.noteTimer > 0) state.noteTimer -= dt;
+  state.hitFlash = Math.max(0, state.hitFlash - dt * 2.2);
 
-  if (state.hp <= 0) {
-    state.gameOver = true;
-    notify("Лодка уничтожена! Нажми R для восстановления у причала.", 5);
-  }
+  if (state.mode === "ship") handleShip(dt);
+  else handleFoot(dt);
 }
 
-function drawTiltedRect(x, y, w, h, color, alpha = 1) {
+function cameraOffset() {
+  const target = state.mode === "ship" ? state.ship : state.player;
+  return {
+    x: target.x - canvas.width / 2,
+    y: target.y - canvas.height / 2,
+  };
+}
+
+function drawOcean(cam) {
+  const sea = ctx.createLinearGradient(0, 0, 0, canvas.height);
+  sea.addColorStop(0, "#56dcff");
+  sea.addColorStop(0.48, "#25bdf2");
+  sea.addColorStop(1, "#0c87cb");
+  ctx.fillStyle = sea;
+  ctx.fillRect(0, 0, canvas.width, canvas.height);
+
   ctx.save();
-  ctx.globalAlpha = alpha;
-  ctx.fillStyle = color;
-  ctx.beginPath();
-  ctx.moveTo(x, y);
-  ctx.lineTo(x + w, y + w * 0.06);
-  ctx.lineTo(x + w, y + h + w * 0.06);
-  ctx.lineTo(x, y + h);
-  ctx.closePath();
-  ctx.fill();
+  ctx.globalAlpha = 0.2;
+  ctx.strokeStyle = "#abf6ff";
+  ctx.lineWidth = 1.5;
+  const step = 140;
+  const ox = ((Math.floor(cam.x) % step) + step) % step;
+  const oy = ((Math.floor(cam.y) % step) + step) % step;
+
+  for (let x = -ox - step; x < canvas.width + step; x += step) {
+    ctx.beginPath();
+    ctx.moveTo(x, 0);
+    ctx.lineTo(x + 80, canvas.height);
+    ctx.stroke();
+  }
+  for (let y = -oy - step; y < canvas.height + step; y += step) {
+    ctx.beginPath();
+    ctx.moveTo(0, y);
+    ctx.lineTo(canvas.width, y + 35);
+    ctx.stroke();
+  }
   ctx.restore();
 }
 
-function render() {
-  ctx.clearRect(0, 0, world.width, world.height);
+function islandColor(type) {
+  if (type === "base") return "#ffd075";
+  if (type === "enemy") return "#ff8b73";
+  if (type === "unique") return "#c68cff";
+  return "#89df6d";
+}
 
-  const grad = ctx.createLinearGradient(0, 0, 0, world.height);
-  grad.addColorStop(0, "#2f82b8");
-  grad.addColorStop(1, "#1b4f76");
-  ctx.fillStyle = grad;
-  ctx.fillRect(0, 0, world.width, world.height);
+function drawWorld(cam) {
+  for (const island of islands) {
+    if (!state.discovered.has(island.id)) continue;
 
-  ctx.save();
-  ctx.globalAlpha = 0.11;
-  for (let i = 0; i < 15; i += 1) {
-    ctx.fillStyle = i % 2 ? "#ffffff" : "#9ad1ff";
-    const y = 35 + i * 34;
-    ctx.fillRect(0, y, world.width, 3);
+    const sx = island.x - cam.x;
+    const sy = island.y - cam.y;
+    if (sx < -island.r - 100 || sx > canvas.width + island.r + 100) continue;
+    if (sy < -island.r - 100 || sy > canvas.height + island.r + 100) continue;
+
+    ctx.fillStyle = islandColor(island.type);
+    ctx.beginPath();
+    ctx.ellipse(sx, sy, island.r, island.r * 0.82, 0, 0, Math.PI * 2);
+    ctx.fill();
+
+    ctx.fillStyle = "rgba(20,55,35,0.2)";
+    ctx.beginPath();
+    ctx.ellipse(sx, sy + island.r * 0.2, island.r * 0.74, island.r * 0.2, 0, 0, Math.PI * 2);
+    ctx.fill();
+
+    ctx.fillStyle = "#fffef8";
+    ctx.font = "bold 12px sans-serif";
+    ctx.fillText(island.name, sx - island.r * 0.46, sy - island.r - 10);
   }
-  ctx.restore();
 
-  drawTiltedRect(zones.shop.x, zones.shop.y, zones.shop.w, zones.shop.h, "#6d4f2fcc", 0.62);
-  drawTiltedRect(zones.fishing.x, zones.fishing.y, zones.fishing.w, zones.fishing.h, "#2f6b2fcc", 0.5);
-
-  ctx.fillStyle = "#ddc59a";
-  ctx.fillRect(90, 294, 90, 18);
-  ctx.fillRect(95, 322, 120, 10);
-
-  for (const t of state.threats) {
-    if (t.kind === "log") {
-      ctx.save();
-      ctx.translate(t.x, t.y);
-      ctx.rotate(Math.sin((t.x + t.y) * 0.01) * 0.4);
-      ctx.fillStyle = "#7f532f";
-      ctx.fillRect(-22, -7, 44, 14);
-      ctx.restore();
-    }
+  for (const res of resources) {
+    if (res.taken || !state.discovered.has(res.islandId)) continue;
 
-    if (t.kind === "whirlpool") {
-      for (let i = 0; i < 3; i += 1) {
-        ctx.strokeStyle = `rgba(223,240,255,${0.35 - i * 0.08})`;
-        ctx.lineWidth = 2;
-        ctx.beginPath();
-        ctx.arc(t.x, t.y, t.r - i * 8, 0, Math.PI * 2);
-        ctx.stroke();
-      }
-    }
+    const sx = res.x - cam.x;
+    const sy = res.y - cam.y;
+    if (sx < -30 || sx > canvas.width + 30 || sy < -30 || sy > canvas.height + 30) continue;
+
+    ctx.fillStyle = res.kind === "wood" ? "#8c5a28" : res.kind === "metal" ? "#d4e5ff" : "#ffe27a";
+    ctx.beginPath();
+    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
+    ctx.fill();
+  }
+
+  for (const enemy of enemies) {
+    if (!state.discovered.has(enemy.islandId)) continue;
+
+    const sx = enemy.x - cam.x;
+    const sy = enemy.y - cam.y;
+    if (sx < -30 || sx > canvas.width + 30 || sy < -30 || sy > canvas.height + 30) continue;
+
+    ctx.fillStyle = "#ff4f6a";
+    ctx.beginPath();
+    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
+    ctx.fill();
+  }
 
-    if (t.kind === "storm") {
-      drawTiltedRect(t.x, t.y, t.w, t.h, "#7c8598", 0.27);
-      ctx.fillStyle = "rgba(230, 239, 255, 0.2)";
-      for (let i = 0; i < 6; i += 1) {
-        const rx = t.x + 20 + i * 35;
-        const ry = t.y + 20 + Math.sin((performance.now() * 0.004) + i) * 4;
-        ctx.fillRect(rx, ry, 2, 18);
+  if (state.mode === "ship") {
+    const sx = state.ship.x - cam.x;
+    const sy = state.ship.y - cam.y;
+
+    ctx.save();
+    ctx.translate(sx, sy);
+    ctx.rotate(state.ship.angle);
+    ctx.fillStyle = "#8a4f22";
+    ctx.beginPath();
+    ctx.moveTo(24, 0);
+    ctx.lineTo(-18, -12);
+    ctx.lineTo(-10, 0);
+    ctx.lineTo(-18, 12);
+    ctx.closePath();
+    ctx.fill();
+
+    ctx.fillStyle = "#f7d9ae";
+    ctx.fillRect(-3, -16, 5, 13);
+    ctx.fillStyle = "#ffefbf";
+    ctx.beginPath();
+    ctx.moveTo(2, -15);
+    ctx.lineTo(15, -6);
+    ctx.lineTo(2, -4);
+    ctx.closePath();
+    ctx.fill();
+    ctx.restore();
+  } else {
+    const sx = state.ship.x - cam.x;
+    const sy = state.ship.y - cam.y;
+    ctx.fillStyle = "#8a4f22";
+    ctx.beginPath();
+    ctx.arc(sx, sy, 14, 0, Math.PI * 2);
+    ctx.fill();
+
+    const px = state.player.x - cam.x;
+    const py = state.player.y - cam.y;
+    ctx.fillStyle = "#ffe0b8";
+    ctx.beginPath();
+    ctx.arc(px, py, 10, 0, Math.PI * 2);
+    ctx.fill();
+
+    let near = null;
+    let best = Infinity;
+    for (const res of resources) {
+      if (res.taken || res.islandId !== state.activeIslandId) continue;
+      const d = Math.hypot(res.x - state.player.x, res.y - state.player.y);
+      if (d < best) {
+        best = d;
+        near = res;
       }
     }
+    if (near && best < 32) {
+      ctx.strokeStyle = "#fff46f";
+      ctx.lineWidth = 2;
+      ctx.beginPath();
+      ctx.arc(near.x - cam.x, near.y - cam.y, 12, 0, Math.PI * 2);
+      ctx.stroke();
+    }
   }
 
-  const b = state.boat;
-  const angle = Math.atan2(b.vy, b.vx);
-  ctx.save();
-  ctx.translate(b.x, b.y);
-  ctx.rotate(angle * 0.35);
-  ctx.scale(1, world.tilt);
+  ctx.fillStyle = "rgba(0,18,44,0.5)";
+  ctx.fillRect(0, 0, canvas.width, canvas.height);
 
-  ctx.fillStyle = "#14334f";
-  ctx.beginPath();
-  ctx.ellipse(0, 6, 20, 9, 0, 0, Math.PI * 2);
-  ctx.fill();
-
-  ctx.fillStyle = state.gameOver ? "#662222" : "#efefe8";
+  ctx.save();
+  ctx.globalCompositeOperation = "destination-out";
+  const shipReveal = state.mode === "ship" ? 230 : 120;
   ctx.beginPath();
-  ctx.moveTo(-17, 0);
-  ctx.lineTo(16, 0);
-  ctx.lineTo(10, 13);
-  ctx.lineTo(-9, 13);
-  ctx.closePath();
+  ctx.arc(state.ship.x - cam.x, state.ship.y - cam.y, shipReveal, 0, Math.PI * 2);
   ctx.fill();
 
-  ctx.fillStyle = "#f7b942";
-  ctx.fillRect(-2, -11, 4, 15);
-  ctx.fillStyle = "#f7e6b2";
-  ctx.beginPath();
-  ctx.moveTo(2, -11);
-  ctx.lineTo(13, -3);
-  ctx.lineTo(2, -1);
-  ctx.closePath();
-  ctx.fill();
+  for (const id of state.discovered) {
+    const island = islandById(id);
+    ctx.beginPath();
+    ctx.arc(island.x - cam.x, island.y - cam.y, island.r + 80, 0, Math.PI * 2);
+    ctx.fill();
+  }
   ctx.restore();
+}
 
-  if (state.dangerFlash > 0) {
-    ctx.fillStyle = `rgba(255,60,60,${0.12 * state.dangerFlash})`;
-    ctx.fillRect(0, 0, world.width, world.height);
+function drawUi() {
+  ctx.fillStyle = "rgba(1,16,36,0.72)";
+  ctx.fillRect(10, 10, 540, 174);
+  ctx.fillStyle = "#f1fdff";
+  ctx.font = "15px sans-serif";
+
+  const mode = state.mode === "ship" ? "корабль" : `пешком (${islandById(state.activeIslandId).name})`;
+  ctx.fillText(`Режим: ${mode}`, 20, 34);
+  ctx.fillText(`Координаты корабля X:${Math.round(state.ship.x)} Y:${Math.round(state.ship.y)}`, 20, 56);
+  ctx.fillText(`HP корабля: ${state.ship.hp.toFixed(0)}/${state.ship.maxHp} | HP персонажа: ${state.player.hp.toFixed(0)}/${state.player.maxHp}`, 20, 78);
+  ctx.fillText(`Ресурсы: дерево ${state.inventory.wood}, металл ${state.inventory.metal}, артефакты ${state.inventory.artifact}`, 20, 100);
+  ctx.fillText(`Трюм: ${cargoUsed()}/${cargoMax()} | Открыто островов: ${state.discovered.size}/${islands.length}`, 20, 122);
+  ctx.fillText(`Улучшения: скорость ${state.ship.speedLevel}, корпус ${state.ship.hullLevel}, трюм ${state.ship.cargoLevel}`, 20, 144);
+  ctx.fillText("Навигация: WASD, E - высадка/сбор, 1/2/3 - апгрейды на базе.", 20, 166);
+
+  if (state.noteTimer > 0) {
+    ctx.fillStyle = "rgba(0,0,0,0.55)";
+    ctx.fillRect(190, canvas.height - 45, 590, 30);
+    ctx.fillStyle = "#f7fdff";
+    ctx.fillText(state.note, 200, canvas.height - 25);
   }
 
-  ctx.fillStyle = "rgba(6,18,33,0.68)";
-  ctx.fillRect(10, 10, 360, 125);
-  ctx.fillStyle = "#eff8ff";
-  ctx.font = "16px sans-serif";
-  ctx.fillText(`Монеты: ${state.cash}`, 20, 34);
-  ctx.fillText(`Рыба: ${state.fish}/${storageLimit()}`, 20, 56);
-  ctx.fillText(`Прочность: ${Math.max(0, state.hp).toFixed(0)}/${state.maxHp}`, 20, 78);
-  ctx.fillText(
-    `Улучшения: Дв ${state.boat.speedLevel} | Корп ${state.boat.hullLevel} | Снаст ${state.boat.rodLevel} | Трюм ${state.boat.storageLevel}`,
-    20,
-    100,
-  );
-
-  if (state.msgTimer > 0) {
-    ctx.fillStyle = "rgba(8, 28, 45, 0.75)";
-    ctx.fillRect(230, world.height - 55, 500, 35);
-    ctx.fillStyle = "#e9f4ff";
-    ctx.fillText(state.msg, 240, world.height - 32);
+  const chartW = 250;
+  const chartH = 150;
+  const chartX = canvas.width - chartW - 12;
+  const chartY = 12;
+
+  ctx.fillStyle = "rgba(3,20,42,0.78)";
+  ctx.fillRect(chartX, chartY, chartW, chartH);
+  ctx.strokeStyle = "#76d8ff";
+  ctx.strokeRect(chartX, chartY, chartW, chartH);
+
+  ctx.fillStyle = "#d5f3ff";
+  ctx.font = "12px sans-serif";
+  ctx.fillText("Навигационная карта (только открытое)", chartX + 8, chartY + 16);
+
+  for (const island of islands) {
+    if (!state.discovered.has(island.id)) continue;
+    const x = chartX + (island.x / world.width) * chartW;
+    const y = chartY + (island.y / world.height) * chartH;
+    ctx.fillStyle = state.visited.has(island.id) ? "#ffe67d" : "#89dbff";
+    ctx.beginPath();
+    ctx.arc(x, y, island.type === "base" ? 4 : 3, 0, Math.PI * 2);
+    ctx.fill();
   }
 
-  ctx.fillStyle = "#d5ecff";
-  ctx.fillText("Причал-магазин", zones.shop.x + 16, zones.shop.y - 10);
-  ctx.fillText("Рыболовная зона", zones.fishing.x + 20, zones.fishing.y - 10);
+  ctx.fillStyle = "#ffb266";
+  ctx.beginPath();
+  ctx.arc(chartX + (state.ship.x / world.width) * chartW, chartY + (state.ship.y / world.height) * chartH, 3, 0, Math.PI * 2);
+  ctx.fill();
 
-  if (inZone(zones.shop)) {
-    ctx.fillStyle = "#fff1d2";
-    ctx.fillText("E: продать рыбу / купить улучшение", 615, 28);
-  }
-  if (inZone(zones.fishing)) {
-    ctx.fillStyle = "#d8ffe2";
-    ctx.fillText("E: попытка ловли", 740, 52);
+  if (state.activeIslandId === "base" && state.mode === "ship") {
+    ctx.fillStyle = "#ffe6bf";
+    ctx.fillText("База: 1 скорость, 2 корпус, 3 трюм, E ремонт", 565, 28);
   }
 
-  if (state.fishingProgress > 0) {
-    const w = 160;
-    const x = world.width - 190;
-    const y = world.height - 40;
-    ctx.fillStyle = "#04243a";
-    ctx.fillRect(x, y, w, 18);
-    ctx.fillStyle = "#5fdb85";
-    ctx.fillRect(x + 2, y + 2, (w - 4) * state.fishingProgress, 14);
+  if (state.hitFlash > 0) {
+    ctx.fillStyle = `rgba(255,70,70,${0.22 * state.hitFlash})`;
+    ctx.fillRect(0, 0, canvas.width, canvas.height);
   }
+}
 
-  if (state.gameOver) {
-    ctx.fillStyle = "rgba(0,0,0,0.55)";
-    ctx.fillRect(0, 0, world.width, world.height);
-    ctx.fillStyle = "#ffe9e9";
-    ctx.font = "bold 28px sans-serif";
-    ctx.fillText("Лодка затонула", 360, 250);
-    ctx.font = "18px sans-serif";
-    ctx.fillText("Нажми R, чтобы восстановиться у причала", 295, 285);
-  }
+function render() {
+  const cam = cameraOffset();
+  drawOcean(cam);
+  drawWorld(cam);
+  drawUi();
 }
 
 document.addEventListener("keydown", (event) => {
-  keys.add(event.key);
-  pressed.add(event.key.toLowerCase());
+  const key = event.key.toLowerCase();
+  keys.add(key);
 
-  if (event.key.toLowerCase() === "e") {
-    if (inZone(zones.shop)) handleShopAction();
-    else handleFishingAction();
+  if (key === "e") {
+    if (state.mode === "foot") gatherNearestResource();
+    tryLandOrBoard();
   }
 
-  if (event.key.toLowerCase() === "r" && state.gameOver) {
-    respawn();
+  if (key === "1" || key === "2" || key === "3") {
+    tryUpgrade(Number(key));
   }
 });
 
 document.addEventListener("keyup", (event) => {
-  keys.delete(event.key);
-  pressed.delete(event.key.toLowerCase());
+  keys.delete(event.key.toLowerCase());
 });
 
-addThreats();
-upgrades[1].apply();
-
-let prev = performance.now();
-function loop(now) {
-  const dt = Math.min(0.033, (now - prev) / 1000);
-  prev = now;
+let previous = performance.now();
+function frame(now) {
+  const dt = Math.min(0.033, (now - previous) / 1000);
+  previous = now;
   update(dt);
   render();
-  requestAnimationFrame(loop);
+  requestAnimationFrame(frame);
 }
 
-requestAnimationFrame(loop);
+requestAnimationFrame(frame);
