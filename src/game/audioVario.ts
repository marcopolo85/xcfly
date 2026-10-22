/** Synthetic acoustic variometer using the Web Audio API. */
export class AudioVario {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private nextBeep = 0;
  muted = false;

  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.osc = this.ctx.createOscillator();
    this.osc.type = "square";
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    this.osc.connect(filter).connect(this.gain).connect(this.ctx.destination);
    this.osc.start();
  }

  update(vz: number) {
    const ctx = this.ctx, g = this.gain, o = this.osc;
    if (!ctx || !g || !o) return;
    const now = ctx.currentTime;
    if (this.muted) { g.gain.setTargetAtTime(0, now, 0.01); return; }
    if (vz > 0.15) {
      if (now >= this.nextBeep) {
        const freq = Math.min(1700, 560 + vz * 160);
        const period = Math.max(0.11, 0.55 - vz * 0.09);
        o.frequency.setValueAtTime(freq, now);
        o.frequency.linearRampToValueAtTime(freq * 1.04, now + period * 0.5);
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(0.11, now);
        g.gain.setValueAtTime(0, now + period * 0.5);
        this.nextBeep = now + period;
      }
    } else if (vz < -2.3) {
      g.gain.cancelScheduledValues(now);
      o.frequency.setTargetAtTime(Math.max(140, 300 + (vz + 2.3) * 25), now, 0.05);
      g.gain.setTargetAtTime(0.07, now, 0.05);
      this.nextBeep = 0;
    } else {
      if (this.nextBeep === 0 || now > this.nextBeep) g.gain.setTargetAtTime(0, now, 0.03);
    }
  }

  stop() {
    void this.ctx?.close();
    this.ctx = null; this.osc = null; this.gain = null;
  }
}
