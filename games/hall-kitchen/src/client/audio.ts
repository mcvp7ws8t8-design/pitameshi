// 音。録音ファイルは使わず、Web Audio でその場で作る(ノイズとサイン波の組み合わせ)。
//  - 環境音: 換気扇の低いうなり、お客さんのざわめき
//  - 調理の音: 焼く(ジュー)・茹でる(ぐつぐつ)・揚げる(パチパチ)。調理中の数に応じて大きくなる
//  - 一回の音: 注文が入る呼び出し音、操作のクリック、料理がさばけたとき、怒って帰ったとき、足音、冷蔵庫の扉
// ブラウザは、画面を操作するまで音を出せないので、最初のクリックかキー入力で始める。M キーでオン・オフ。

export type Floor = "wood" | "tile";

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private loops: Record<"room" | "crowd" | "grill" | "boil" | "fry", GainNode> | null = null;
  private enabled = true;
  private listener = 1; // キッチンの音は、ホールでは小さく聞こえる

  /** 最初の操作で呼ぶ(音を出す準備) */
  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.master.connect(ctx.destination);
    // 2秒ぶんの白色ノイズ(これを繰り返して、いろいろな音にする)
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.loops = {
      room: this.loop("lowpass", 380, 0.7, 0.05), // 換気扇
      crowd: this.loop("bandpass", 700, 0.6, 0), // お客さんのざわめき
      grill: this.loop("highpass", 3500, 0.7, 0), // ジュー
      boil: this.loop("lowpass", 700, 0.8, 0), // ぐつぐつ
      fry: this.loop("bandpass", 2600, 1.2, 0), // パチパチ
    };
    // 換気扇のうなり
    const hum = ctx.createOscillator();
    const hg = ctx.createGain();
    hum.frequency.value = 96;
    hg.gain.value = 0.012;
    hum.connect(hg).connect(this.master);
    hum.start();
    // ぐつぐつ・パチパチ・ジューは、音量をランダムに揺らして本物らしくする
    setInterval(() => {
      if (!this.loops || !this.ctx) return;
      const t = this.ctx.currentTime;
      for (const k of ["boil", "fry", "grill"] as const) {
        const g = this.loops[k].gain;
        const base = this.level[k];
        const wobble = k === "boil" ? 0.6 : k === "fry" ? 1.0 : 0.35;
        g.cancelScheduledValues(t);
        g.setTargetAtTime(base * (1 - wobble * 0.5 + Math.random() * wobble), t, 0.04);
      }
    }, 90);
  }

  private level = { grill: 0, boil: 0, fry: 0 };

  private loop(type: BiquadFilterType, freq: number, q: number, gain: number): GainNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    return g;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.ctx) this.master.gain.setTargetAtTime(this.enabled ? 0.8 : 0, this.ctx.currentTime, 0.05);
    return this.enabled;
  }
  get on() {
    return this.enabled;
  }

  /** 自分の役割(キッチンの音はキッチンで大きく、ホールではこもって聞こえる) */
  setRole(role: "hall" | "kitchen" | null) {
    this.listener = role === "kitchen" ? 1 : 0.3;
  }

  /** いまの店の様子。調理中の台数と、座っているお客さんの数 */
  setScene(s: { grill: number; boil: number; fry: number; seated: number }) {
    if (!this.ctx || !this.loops) return;
    const v = this.listener;
    this.level.grill = Math.min(1, s.grill / 3) * 0.1 * v;
    this.level.boil = Math.min(1, s.boil / 3) * 0.14 * v;
    this.level.fry = Math.min(1, s.fry / 2) * 0.12 * v;
    this.loops.crowd.gain.setTargetAtTime(Math.min(1, s.seated / 16) * 0.05 * (this.listener === 1 ? 0.3 : 1), this.ctx.currentTime, 0.4);
    this.loops.room.gain.setTargetAtTime(0.04 * (this.listener === 1 ? 1.4 : 0.6), this.ctx.currentTime, 0.4);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(type: BiquadFilterType, freq: number, dur: number, vol: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loopStart = Math.random();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  /** 注文が入った(キッチン)。呼び出しのベル */
  order() {
    this.tone(1319, 0.5, "sine", 0.18);
    this.tone(1760, 0.6, "sine", 0.12, 0.09);
  }
  /** E キーの操作 */
  action() {
    this.burst("highpass", 2500, 0.05, 0.25);
    this.tone(660, 0.07, "triangle", 0.1);
  }
  /** 料理がさばけた */
  served() {
    this.tone(784, 0.18, "triangle", 0.16);
    this.tone(988, 0.18, "triangle", 0.16, 0.08);
    this.tone(1319, 0.3, "triangle", 0.16, 0.16);
  }
  /** お客さんが怒って帰った */
  angry() {
    this.tone(180, 0.4, "sawtooth", 0.14, 0, 90);
  }
  beep() {
    this.tone(880, 0.12, "sine", 0.18);
  }
  go() {
    this.tone(1320, 0.4, "sine", 0.2);
  }
  over() {
    [523, 392, 330, 262].forEach((f, i) => this.tone(f, 0.35, "triangle", 0.16, i * 0.2));
  }
  /** 冷蔵庫の扉 */
  fridge() {
    this.tone(70, 0.25, "sine", 0.3, 0, 45);
    this.burst("lowpass", 500, 0.35, 0.18);
  }
  /** 足音 */
  step(floor: Floor) {
    if (floor === "wood") {
      this.burst("lowpass", 700 + Math.random() * 200, 0.09, 0.22);
      this.tone(110 + Math.random() * 20, 0.08, "sine", 0.12);
    } else {
      this.burst("highpass", 1800 + Math.random() * 600, 0.05, 0.2);
      this.tone(380 + Math.random() * 60, 0.05, "square", 0.025);
    }
  }
}
