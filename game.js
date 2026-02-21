const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const world = {
  width: canvas.width,
  height: canvas.height,
  tilt: 0.6,
};

const keys = new Set();
const pressed = new Set();

const state = {
  cash: 60,
  fish: 0,
  hp: 100,
  maxHp: 100,
  boat: {
    x: 180,
    y: 330,
    vx: 0,
    vy: 0,
    baseSpeed: 115,
    speedLevel: 0,
    hullLevel: 0,
    rodLevel: 0,
    storageLevel: 0,
    storageBase: 6,
  },
  threats: [],
  msg: "Отправляйся в рыболовную зону.",
  msgTimer: 5,
  dangerFlash: 0,
  fishCooldown: 0,
  fishingProgress: 0,
  shopOpen: false,
  gameOver: false,
};

const zones = {
  shop: { x: 70, y: 270, w: 170, h: 160, title: "Причал / магазин" },
  fishing: { x: 540, y: 130, w: 320, h: 260, title: "Зона ловли" },
};

const upgrades = [
  {
    key: "speedLevel",
    name: "Двигатель",
    baseCost: 45,
    max: 5,
    desc: "+10% к скорости лодки",
    apply: () => {},
  },
  {
    key: "hullLevel",
    name: "Корпус",
    baseCost: 55,
    max: 5,
    desc: "+18 макс. прочности",
    apply: () => {
      state.maxHp = 100 + state.boat.hullLevel * 18;
      state.hp = Math.min(state.maxHp, state.hp + 14);
    },
  },
  {
    key: "rodLevel",
    name: "Снасти",
    baseCost: 40,
    max: 5,
    desc: "Быстрее и выгоднее ловля",
    apply: () => {},
  },
  {
    key: "storageLevel",
    name: "Трюм",
    baseCost: 35,
    max: 5,
    desc: "+2 к вместимости",
    apply: () => {},
  },
];

function storageLimit() {
  return state.boat.storageBase + state.boat.storageLevel * 2;
}

function speedMultiplier() {
  return 1 + state.boat.speedLevel * 0.1;
}

function rodMultiplier() {
  return 1 + state.boat.rodLevel * 0.18;
}

function notify(text, seconds = 2.2) {
  state.msg = text;
  state.msgTimer = seconds;
}

function addThreats() {
  const safe = zones.shop;
  for (let i = 0; i < 3; i += 1) {
    state.threats.push({
      kind: "log",
      x: 360 + Math.random() * 500,
      y: 80 + Math.random() * 380,
      vx: (Math.random() > 0.5 ? 1 : -1) * (30 + Math.random() * 40),
      vy: (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 35),
      r: 18,
    });
  }
  for (let i = 0; i < 2; i += 1) {
    state.threats.push({
      kind: "whirlpool",
      x: safe.x + safe.w + 130 + Math.random() * 450,
      y: 90 + Math.random() * 380,
      strength: 26 + Math.random() * 12,
      r: 32,
    });
  }
  state.threats.push({
    kind: "storm",
    x: 430,
    y: 55,
    w: 240,
    h: 140,
    pulse: 0,
  });
}

function inZone(z, x = state.boat.x, y = state.boat.y) {
  return x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h;
}

function handleShopAction() {
  if (!inZone(zones.shop)) return;

  if (state.fish > 0) {
    const gain = Math.round(state.fish * (18 + state.boat.rodLevel * 5));
    state.cash += gain;
    notify(`Продано рыбы: +${gain} монет.`);
    state.fish = 0;
    return;
  }

  for (const up of upgrades) {
    const level = state.boat[up.key];
    if (level >= up.max) continue;
    const price = up.baseCost + level * 30;
    if (state.cash >= price) {
      state.cash -= price;
      state.boat[up.key] += 1;
      up.apply();
      notify(`${up.name} улучшен до ${state.boat[up.key]} уровня.`);
      return;
    }
  }

  notify("Недостаточно денег или всё улучшено.");
}

function handleFishingAction() {
  if (!inZone(zones.fishing)) {
    notify("Ловить можно только в рыболовной зоне.");
    return;
  }

  if (state.fish >= storageLimit()) {
    notify("Трюм полон! Вернись на причал.");
    return;
  }

  if (state.fishCooldown > 0) return;
  state.fishingProgress = 0.3;
  const chance = 0.6 + state.boat.rodLevel * 0.08;
  const caught = Math.random() < chance ? 1 : 0;
  if (caught) {
    state.fish += 1;
    notify("Поймал рыбу!", 1.4);
  } else {
    notify("Рыба сорвалась.", 1.2);
  }
  state.fishCooldown = 0.65 / rodMultiplier();
}

function respawn() {
  state.boat.x = 170;
  state.boat.y = 330;
  state.boat.vx = 0;
  state.boat.vy = 0;
  const penalty = Math.min(state.cash, 35);
  state.cash -= penalty;
  state.fish = Math.max(0, state.fish - 2);
  state.hp = state.maxHp;
  state.gameOver = false;
  notify(`Лодка восстановлена. Штраф ${penalty} монет.`);
}

function update(dt) {
  if (state.msgTimer > 0) state.msgTimer -= dt;
  state.dangerFlash = Math.max(0, state.dangerFlash - dt * 1.5);
  state.fishCooldown = Math.max(0, state.fishCooldown - dt);
  state.fishingProgress = Math.max(0, state.fishingProgress - dt * 1.3);

  if (state.gameOver) return;

  const b = state.boat;
  const accel = 260 * speedMultiplier();

  let ix = 0;
  let iy = 0;

  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) ix -= 1;
  if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) ix += 1;
  if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) iy -= 1;
  if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) iy += 1;

  const len = Math.hypot(ix, iy) || 1;
  ix /= len;
  iy /= len;

  b.vx += ix * accel * dt;
  b.vy += iy * accel * dt;

  const maxSpeed = b.baseSpeed * speedMultiplier();
  const spd = Math.hypot(b.vx, b.vy);
  if (spd > maxSpeed) {
    b.vx = (b.vx / spd) * maxSpeed;
    b.vy = (b.vy / spd) * maxSpeed;
  }

  b.vx *= 0.91;
  b.vy *= 0.91;

  for (const t of state.threats) {
    if (t.kind === "log") {
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.x < 280 || t.x > world.width - 30) t.vx *= -1;
      if (t.y < 45 || t.y > world.height - 40) t.vy *= -1;

      const d = Math.hypot(t.x - b.x, t.y - b.y);
      if (d < t.r + 12) {
        b.vx += (b.x - t.x) * 2.5 * dt;
        b.vy += (b.y - t.y) * 2.5 * dt;
        state.hp -= 12 * dt;
        state.dangerFlash = 1;
      }
    }

    if (t.kind === "whirlpool") {
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < t.r * 2.3) {
        b.vx += (dx / (d || 1)) * t.strength * dt;
        b.vy += (dy / (d || 1)) * t.strength * dt;
        state.hp -= 8 * dt;
        state.dangerFlash = 0.9;
      }
    }

    if (t.kind === "storm") {
      t.pulse += dt;
      if (inZone(t, b.x, b.y)) {
        b.vx *= 0.985;
        b.vy *= 0.985;
        state.hp -= (6 + Math.sin(t.pulse * 6) * 2) * dt;
        state.dangerFlash = 0.8;
      }
    }
  }

  b.x += b.vx * dt;
  b.y += b.vy * dt;

  b.x = Math.max(25, Math.min(world.width - 25, b.x));
  b.y = Math.max(35, Math.min(world.height - 25, b.y));

  if (state.hp <= 0) {
    state.gameOver = true;
    notify("Лодка уничтожена! Нажми R для восстановления у причала.", 5);
  }
}

function drawTiltedRect(x, y, w, h, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + w * 0.06);
  ctx.lineTo(x + w, y + h + w * 0.06);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, world.width, world.height);

  const grad = ctx.createLinearGradient(0, 0, 0, world.height);
  grad.addColorStop(0, "#2f82b8");
  grad.addColorStop(1, "#1b4f76");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.save();
  ctx.globalAlpha = 0.11;
  for (let i = 0; i < 15; i += 1) {
    ctx.fillStyle = i % 2 ? "#ffffff" : "#9ad1ff";
    const y = 35 + i * 34;
    ctx.fillRect(0, y, world.width, 3);
  }
  ctx.restore();

  drawTiltedRect(zones.shop.x, zones.shop.y, zones.shop.w, zones.shop.h, "#6d4f2fcc", 0.62);
  drawTiltedRect(zones.fishing.x, zones.fishing.y, zones.fishing.w, zones.fishing.h, "#2f6b2fcc", 0.5);

  ctx.fillStyle = "#ddc59a";
  ctx.fillRect(90, 294, 90, 18);
  ctx.fillRect(95, 322, 120, 10);

  for (const t of state.threats) {
    if (t.kind === "log") {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(Math.sin((t.x + t.y) * 0.01) * 0.4);
      ctx.fillStyle = "#7f532f";
      ctx.fillRect(-22, -7, 44, 14);
      ctx.restore();
    }

    if (t.kind === "whirlpool") {
      for (let i = 0; i < 3; i += 1) {
        ctx.strokeStyle = `rgba(223,240,255,${0.35 - i * 0.08})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r - i * 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (t.kind === "storm") {
      drawTiltedRect(t.x, t.y, t.w, t.h, "#7c8598", 0.27);
      ctx.fillStyle = "rgba(230, 239, 255, 0.2)";
      for (let i = 0; i < 6; i += 1) {
        const rx = t.x + 20 + i * 35;
        const ry = t.y + 20 + Math.sin((performance.now() * 0.004) + i) * 4;
        ctx.fillRect(rx, ry, 2, 18);
      }
    }
  }

  const b = state.boat;
  const angle = Math.atan2(b.vy, b.vx);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(angle * 0.35);
  ctx.scale(1, world.tilt);

  ctx.fillStyle = "#14334f";
  ctx.beginPath();
  ctx.ellipse(0, 6, 20, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = state.gameOver ? "#662222" : "#efefe8";
  ctx.beginPath();
  ctx.moveTo(-17, 0);
  ctx.lineTo(16, 0);
  ctx.lineTo(10, 13);
  ctx.lineTo(-9, 13);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f7b942";
  ctx.fillRect(-2, -11, 4, 15);
  ctx.fillStyle = "#f7e6b2";
  ctx.beginPath();
  ctx.moveTo(2, -11);
  ctx.lineTo(13, -3);
  ctx.lineTo(2, -1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (state.dangerFlash > 0) {
    ctx.fillStyle = `rgba(255,60,60,${0.12 * state.dangerFlash})`;
    ctx.fillRect(0, 0, world.width, world.height);
  }

  ctx.fillStyle = "rgba(6,18,33,0.68)";
  ctx.fillRect(10, 10, 360, 125);
  ctx.fillStyle = "#eff8ff";
  ctx.font = "16px sans-serif";
  ctx.fillText(`Монеты: ${state.cash}`, 20, 34);
  ctx.fillText(`Рыба: ${state.fish}/${storageLimit()}`, 20, 56);
  ctx.fillText(`Прочность: ${Math.max(0, state.hp).toFixed(0)}/${state.maxHp}`, 20, 78);
  ctx.fillText(
    `Улучшения: Дв ${state.boat.speedLevel} | Корп ${state.boat.hullLevel} | Снаст ${state.boat.rodLevel} | Трюм ${state.boat.storageLevel}`,
    20,
    100,
  );

  if (state.msgTimer > 0) {
    ctx.fillStyle = "rgba(8, 28, 45, 0.75)";
    ctx.fillRect(230, world.height - 55, 500, 35);
    ctx.fillStyle = "#e9f4ff";
    ctx.fillText(state.msg, 240, world.height - 32);
  }

  ctx.fillStyle = "#d5ecff";
  ctx.fillText("Причал-магазин", zones.shop.x + 16, zones.shop.y - 10);
  ctx.fillText("Рыболовная зона", zones.fishing.x + 20, zones.fishing.y - 10);

  if (inZone(zones.shop)) {
    ctx.fillStyle = "#fff1d2";
    ctx.fillText("E: продать рыбу / купить улучшение", 615, 28);
  }
  if (inZone(zones.fishing)) {
    ctx.fillStyle = "#d8ffe2";
    ctx.fillText("E: попытка ловли", 740, 52);
  }

  if (state.fishingProgress > 0) {
    const w = 160;
    const x = world.width - 190;
    const y = world.height - 40;
    ctx.fillStyle = "#04243a";
    ctx.fillRect(x, y, w, 18);
    ctx.fillStyle = "#5fdb85";
    ctx.fillRect(x + 2, y + 2, (w - 4) * state.fishingProgress, 14);
  }

  if (state.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, world.width, world.height);
    ctx.fillStyle = "#ffe9e9";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("Лодка затонула", 360, 250);
    ctx.font = "18px sans-serif";
    ctx.fillText("Нажми R, чтобы восстановиться у причала", 295, 285);
  }
}

document.addEventListener("keydown", (event) => {
  keys.add(event.key);
  pressed.add(event.key.toLowerCase());

  if (event.key.toLowerCase() === "e") {
    if (inZone(zones.shop)) handleShopAction();
    else handleFishingAction();
  }

  if (event.key.toLowerCase() === "r" && state.gameOver) {
    respawn();
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.key);
  pressed.delete(event.key.toLowerCase());
});

addThreats();
upgrades[1].apply();

let prev = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - prev) / 1000);
  prev = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
