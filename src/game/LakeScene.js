import { Boat } from './Boat.js';

export class LakeScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.bounds = {
      x: 50,
      y: 50,
      width: canvas.width - 100,
      height: canvas.height - 100,
    };

    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    this.money = 100;
    this.inventory = {
      fish: 0,
      catch: 0,
    };

    const startX = this.bounds.x + this.bounds.width / 2;
    const startY = this.bounds.y + this.bounds.height / 2;
    this.boat = new Boat(startX, startY);

    this.setupInput();
  }

  setupInput() {
    const keyMap = {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
    };

    window.addEventListener('keydown', (event) => {
      const direction = keyMap[event.code];
      if (!direction) return;
      this.input[direction] = true;
      event.preventDefault();
    });

    window.addEventListener('keyup', (event) => {
      const direction = keyMap[event.code];
      if (!direction) return;
      this.input[direction] = false;
      event.preventDefault();
    });
  }

  update(dt) {
    this.boat.update(dt, this.input, this.bounds);
  }

  drawBackground() {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#2f86b8');
    gradient.addColorStop(1, '#0f4f76');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(169, 221, 255, 0.08)';
    for (let y = this.bounds.y; y < this.bounds.y + this.bounds.height; y += 26) {
      ctx.fillRect(this.bounds.x, y, this.bounds.width, 3);
    }

    ctx.strokeStyle = '#f7cc8f';
    ctx.lineWidth = 8;
    ctx.strokeRect(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);
  }

  drawHud() {
    const ctx = this.ctx;
    const speed = this.boat.getSpeed();

    ctx.fillStyle = 'rgba(5, 15, 26, 0.68)';
    ctx.fillRect(16, 16, 260, 104);

    ctx.strokeStyle = '#9dd5ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 260, 104);

    ctx.fillStyle = '#e9f6ff';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Скорость: ${speed.toFixed(1)}`, 30, 45);
    ctx.fillText(`Деньги: $${this.money}`, 30, 72);
    ctx.fillText(`Инвентарь: рыба ${this.inventory.fish}, улов ${this.inventory.catch}`, 30, 99);
  }

  render() {
    this.drawBackground();
    this.boat.draw(this.ctx);
    this.drawHud();
  }
}
