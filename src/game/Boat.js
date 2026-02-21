export class Boat {
  constructor(x, y) {
    this.position = { x, y };
    this.velocity = { x: 0, y: 0 };
    this.angle = -Math.PI / 2;

    this.acceleration = 420;
    this.maxSpeed = 260;
    this.friction = 0.94;

    this.width = 44;
    this.height = 20;
  }

  update(dt, input, bounds) {
    let axisX = 0;
    let axisY = 0;

    if (input.left) axisX -= 1;
    if (input.right) axisX += 1;
    if (input.up) axisY -= 1;
    if (input.down) axisY += 1;

    if (axisX !== 0 || axisY !== 0) {
      const length = Math.hypot(axisX, axisY);
      axisX /= length;
      axisY /= length;

      this.velocity.x += axisX * this.acceleration * dt;
      this.velocity.y += axisY * this.acceleration * dt;
      this.angle = Math.atan2(axisY, axisX);
    }

    this.velocity.x *= this.friction;
    this.velocity.y *= this.friction;

    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    if (speed > this.maxSpeed) {
      const factor = this.maxSpeed / speed;
      this.velocity.x *= factor;
      this.velocity.y *= factor;
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    const halfW = this.width / 2;
    const halfH = this.height / 2;

    if (this.position.x - halfW < bounds.x) {
      this.position.x = bounds.x + halfW;
      this.velocity.x = 0;
    }
    if (this.position.x + halfW > bounds.x + bounds.width) {
      this.position.x = bounds.x + bounds.width - halfW;
      this.velocity.x = 0;
    }
    if (this.position.y - halfH < bounds.y) {
      this.position.y = bounds.y + halfH;
      this.velocity.y = 0;
    }
    if (this.position.y + halfH > bounds.y + bounds.height) {
      this.position.y = bounds.y + bounds.height - halfH;
      this.velocity.y = 0;
    }
  }

  getSpeed() {
    return Math.hypot(this.velocity.x, this.velocity.y);
  }

  draw(ctx) {
    const { x, y } = this.position;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.angle);

    ctx.fillStyle = '#f6e0b5';
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, 12);
    ctx.lineTo(-18, 0);
    ctx.lineTo(-14, -12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#6d3f19';
    ctx.fillRect(-6, -7, 16, 14);

    ctx.strokeStyle = '#142029';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}
