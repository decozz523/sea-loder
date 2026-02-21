import { LakeScene } from './game/LakeScene.js';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Canvas #game not found');
}

const scene = new LakeScene(canvas);

let lastTime = performance.now();

function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 20);
  lastTime = now;

  scene.update(dt);
  scene.render();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
