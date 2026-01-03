export class SimpleKalman {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;

    this.vx = 0;
    this.vy = 0;

    this.alpha = 0.8;
    this.beta = 0.2;
  }

  predict() {
    this.x += this.vx;
    this.y += this.vy;
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  update(meas) {
    const dx = meas.x - this.x;
    const dy = meas.y - this.y;

    this.x += this.alpha * dx;
    this.y += this.alpha * dy;

    this.vx += this.beta * dx;
    this.vy += this.beta * dy;

    this.w = this.w * 0.8 + meas.w * 0.2;
    this.h = this.h * 0.8 + meas.h * 0.2;
  }
}
