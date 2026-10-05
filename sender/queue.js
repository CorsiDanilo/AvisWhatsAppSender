const { EventEmitter } = require('node:events');

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class SendQueue extends EventEmitter {
  constructor({
    items,
    send,
    render,
    sleep = realSleep,
    random = Math.random,
    minDelayMs = 15000,
    maxDelayMs = 35000,
    pauseAfter = 40,
    pauseMs = 15 * 60 * 1000,
  }) {
    super();
    this.items = items;
    this.send = send;
    this.render = render;
    this.sleep = sleep;
    this.random = random;
    this.minDelayMs = minDelayMs;
    this.maxDelayMs = Math.max(minDelayMs, maxDelayMs);
    this.pauseAfter = pauseAfter;
    this.pauseMs = pauseMs;
    this.state = 'idle';
    this._runPromise = null;
    this._resumeWaiters = [];
  }

  start() {
    if (this._runPromise) return this._runPromise;
    this.state = 'running';
    this.emit('state', this.state);
    this._runPromise = this._run();
    return this._runPromise;
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.emit('paused');
    this.emit('state', this.state);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.emit('state', this.state);
    for (const resolve of this._resumeWaiters.splice(0)) resolve();
  }

  stop() {
    if (this.state === 'completed' || this.state === 'stopped') return;
    this.state = 'stopped';
    this.emit('state', this.state);
    this.emit('stopped');
    for (const resolve of this._resumeWaiters.splice(0)) resolve();
  }

  async _waitUntilRunning() {
    while (this.state === 'paused') {
      await new Promise((resolve) => this._resumeWaiters.push(resolve));
    }
    return this.state !== 'stopped';
  }

  async _wait(ms) {
    let remaining = ms;
    while (remaining > 0 && this.state !== 'stopped') {
      if (!(await this._waitUntilRunning())) return false;
      const slice = Math.min(remaining, 250);
      const started = Date.now();
      await this.sleep(slice);
      remaining -= Math.max(1, Date.now() - started);
    }
    return this.state !== 'stopped';
  }

  _randomDelay() {
    if (this.maxDelayMs === this.minDelayMs) return this.minDelayMs;
    return Math.floor(this.random() * (this.maxDelayMs - this.minDelayMs + 1)) + this.minDelayMs;
  }

  async _run() {
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (let index = 0; index < this.items.length; index += 1) {
      const donor = this.items[index];
      if (this.state === 'stopped') break;

      if (!donor.valid) {
        donor.status = 'skipped';
        skipped += 1;
        this.emit('item', { donor, index, total: this.items.length });
        this.emit('progress', { current: index + 1, total: this.items.length, sent, failed, skipped });
        continue;
      }

      if (donor.status === 'sent') {
        this.emit('item', { donor, index, total: this.items.length });
        this.emit('progress', { current: index + 1, total: this.items.length, sent, failed, skipped });
        continue;
      }

      if (!(await this._waitUntilRunning())) break;

      const message = this.render(donor);
      try {
        await this.send(donor, message);
        donor.status = 'sent';
        sent += 1;
        this.emit('log', `Messaggio inviato a ${donor.name || donor.phone}`);
      } catch (error) {
        donor.status = 'failed';
        donor.error = error.message;
        failed += 1;
        this.emit('error', { donor, error });
      }

      this.emit('item', { donor, index, total: this.items.length });
      this.emit('progress', { current: index + 1, total: this.items.length, sent, failed, skipped });
      if (this.state === 'stopped' || index === this.items.length - 1) break;

      if (this.pauseAfter > 0 && (sent + failed) % this.pauseAfter === 0) {
        this.emit('log', `Pausa automatica di ${Math.round(this.pauseMs / 60000)} minuti`);
        if (!(await this._wait(this.pauseMs))) break;
      } else if (!(await this._wait(this._randomDelay()))) {
        break;
      }
    }

    if (this.state !== 'stopped') {
      this.state = 'completed';
      this.emit('state', this.state);
      this.emit('completed', { sent, failed, skipped });
    }
  }
}

module.exports = { SendQueue };
