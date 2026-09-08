/** Arcade-style Web Audio synth. Unlocked on the first user gesture. */

type SirenKind = "chase" | "fright" | "eyes" | "off";

export class ArcadeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  muted = false;
  private unlocked = false;
  private siren: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenKind: SirenKind = "off";
  private munchFlip = false;
  private lastMunch = 0;

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx.gain.value = 0.55;
      this.music.gain.value = 0.4;
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.unlocked = true;
  }

  resume(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.02);
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    gain = 0.12,
    when = 0,
    dest: GainNode | null = null,
  ): void {
    if (!this.ctx || !this.sfx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest ?? this.sfx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  munch(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastMunch < 0.07) return;
    this.lastMunch = now;
    this.munchFlip = !this.munchFlip;
    this.tone(this.munchFlip ? 392 : 330, 0.07, "square", 0.08);
  }

  power(): void {
    this.tone(220, 0.12, "square", 0.1);
    this.tone(330, 0.16, "square", 0.08, 0.06);
    this.tone(440, 0.2, "square", 0.07, 0.12);
  }

  eatGhost(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this.tone(f, 0.12, "square", 0.1, i * 0.07));
  }

  fruit(): void {
    this.tone(660, 0.1, "square", 0.1);
    this.tone(880, 0.12, "square", 0.1, 0.08);
    this.tone(1320, 0.16, "square", 0.08, 0.16);
  }

  extraLife(): void {
    [880, 1174, 1760].forEach((f, i) => this.tone(f, 0.18, "square", 0.1, i * 0.12));
  }

  credit(): void {
    this.tone(440, 0.08, "square", 0.08);
    this.tone(880, 0.12, "square", 0.08, 0.06);
  }

  death(): void {
    this.stopSiren();
    if (!this.ctx || !this.sfx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(80, t0 + 1.4);
    g.gain.setValueAtTime(0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.45);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start(t0);
    osc.stop(t0 + 1.5);
  }

  intro(): void {
    if (!this.ctx || !this.music || this.muted) return;
    const phrase = [523, 1046, 784, 659, 1046, 784, 659];
    const phrase2 = [554, 1108, 830, 698, 1108, 830, 698];
    const phrase3 = [622, 1244, 932, 740, 1244, 932, 740, 659, 1318];
    const play = (notes: number[], offset: number) => {
      notes.forEach((f, i) => this.tone(f, 0.11, "square", 0.09, offset + i * 0.09, this.music));
    };
    play(phrase, 0);
    play(phrase2, 0.7);
    play(phrase3, 1.4);
  }

  setSiren(kind: SirenKind, remainingRatio = 1): void {
    if (kind === this.sirenKind && kind !== "chase") return;
    if (kind === "off") {
      this.stopSiren();
      return;
    }
    if (!this.ctx || !this.music || this.muted) {
      this.sirenKind = kind;
      return;
    }
    if (this.siren && this.sirenKind === kind) {
      const base = kind === "chase" ? 160 + (1 - remainingRatio) * 80 : kind === "eyes" ? 420 : 120;
      try {
        this.siren.frequency.setTargetAtTime(base, this.ctx.currentTime, 0.15);
      } catch {
        /* ignore */
      }
      return;
    }
    this.stopSiren();
    this.sirenKind = kind;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const g = this.ctx.createGain();
    osc.type = "triangle";
    lfo.type = "triangle";
    const base = kind === "chase" ? 160 + (1 - remainingRatio) * 80 : kind === "eyes" ? 420 : 120;
    osc.frequency.value = base;
    lfo.frequency.value = kind === "fright" ? 4 : kind === "eyes" ? 8 : 2.4;
    lfoGain.gain.value = kind === "eyes" ? 40 : 18;
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.05);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(g);
    g.connect(this.music);
    osc.start();
    lfo.start();
    this.siren = osc;
    this.sirenGain = g;
    this.sirenLfo = lfo;
  }

  stopSiren(): void {
    this.sirenKind = "off";
    const ctx = this.ctx;
    const g = this.sirenGain;
    const osc = this.siren;
    const lfo = this.sirenLfo;
    this.siren = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    if (!ctx || !g || !osc) return;
    try {
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
    } catch {
      /* ignore */
    }
    const stopAt = ctx.currentTime + 0.15;
    try {
      osc.stop(stopAt);
      lfo?.stop(stopAt);
    } catch {
      /* ignore */
    }
  }

  get ready(): boolean {
    return this.unlocked;
  }
}
