"use strict";
// 効果音とBGM(ブラウザのWebAudioで合成。音声ファイルは使わない)
const Snd = (() => {
  let ac = null, master = null, sfxG = null, bgmG = null, noiseBuf = null;
  const st = { sfx: true, bgm: true };
  try { Object.assign(st, JSON.parse(localStorage.getItem("ck-snd") || "{}")); } catch {}
  const save = () => { try { localStorage.setItem("ck-snd", JSON.stringify(st)); } catch {} };

  function init() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxG = ac.createGain(); sfxG.gain.value = st.sfx ? 1 : 0; sfxG.connect(master);
    bgmG = ac.createGain(); bgmG.gain.value = st.bgm ? 1 : 0; bgmG.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (wantMusic) startMusic(wantMusic);
  }
  function tone(f, dur, type = "sine", vol = 0.2, slide = 0, delay = 0, dest) {
    if (!ac) return;
    const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxG); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol = 0.15, freq = 3000, type = "highpass", delay = 0, dest) {
    if (!ac) return;
    const t0 = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxG); s.start(t0, Math.random() * 0.3); s.stop(t0 + dur + 0.05);
  }
  const SFX = {
    click: () => tone(880, 0.06, "square", 0.08),
    pick: () => { tone(520, 0.09, "sine", 0.18, 820); },
    put: () => { tone(420, 0.08, "triangle", 0.2, 280); },
    chop: () => { noise(0.05, 0.22, 2500); tone(180, 0.05, "square", 0.08, 90); },
    chopDone: () => { tone(660, 0.08, "triangle", 0.18); tone(990, 0.1, "triangle", 0.18, 0, 0.07); },
    sizzle: () => noise(0.35, 0.07, 5000),
    done: () => { tone(1318, 0.35, "sine", 0.2); tone(1760, 0.3, "sine", 0.12, 0, 0.1); },
    burn: () => { tone(160, 0.5, "sawtooth", 0.14, 70); noise(0.4, 0.12, 900, "lowpass"); },
    fire: () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 660 : 880, 0.12, "square", 0.1, 0, i * 0.14); },
    deliver: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "triangle", 0.2, 0, i * 0.07)); },
    coin: () => { tone(1568, 0.07, "square", 0.1); tone(2093, 0.18, "square", 0.1, 0, 0.07); },
    wrong: () => tone(210, 0.28, "sawtooth", 0.14, 120),
    order: () => { tone(988, 0.18, "sine", 0.2); tone(1319, 0.3, "sine", 0.15, 0, 0.1); },
    wash: () => noise(0.18, 0.1, 1800, "bandpass"),
    star: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.2, "triangle", 0.2, 0, i * 0.12)); },
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, "triangle", 0.22, 0, i * 0.1)); },
    lose: () => { [440, 392, 330].forEach((f, i) => tone(f, 0.25, "triangle", 0.18, 0, i * 0.16)); },
    tick: () => tone(1000, 0.04, "square", 0.06),
    go: () => { tone(784, 0.12, "square", 0.12); tone(1175, 0.3, "square", 0.12, 0, 0.12); },
    event: () => { tone(300, 0.3, "sawtooth", 0.12, 600); tone(600, 0.3, "sawtooth", 0.1, 300, 0.3); },
  };
  function play(name) { if (!ac || !st.sfx) return; try { SFX[name] && SFX[name](); } catch {} }

  // ---- BGM: 4小節のコード進行をぐるぐる回す ----
  let timer = null, step = 0, nextT = 0, wantMusic = null, mood = null;
  const MIDI = n => 440 * Math.pow(2, (n - 69) / 12);
  const PROG = [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]];     // I vi IV V
  const PENTA = [0, 2, 4, 7, 9];
  const MOODS = [
    { root: 60, bpm: 116 }, { root: 62, bpm: 120 }, { root: 65, bpm: 124 }, { root: 60, bpm: 128 }, { root: 67, bpm: 124 },
    { root: 62, bpm: 132 }, { root: 64, bpm: 136 }, { root: 65, bpm: 112 }, { root: 60, bpm: 126 }, { root: 62, bpm: 140 },
  ];
  function sched() {
    if (!ac || !mood) return;
    const spb = 60 / mood.bpm / 2;                                    // 8分音符
    while (nextT < ac.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % 4, beat = step % 8, ch = PROG[bar], t = Math.max(0, nextT - ac.currentTime);
      const g = bgmG, base = mood.root;
      if (beat % 4 === 0) tone(MIDI(base - 24 + ch[0]), spb * 3.6, "triangle", 0.16, 0, t, g);                 // ベース
      if (beat % 2 === 1) noise(0.04, mood.menu ? 0.02 : 0.05, 7000, "highpass", t, g);                          // ハイハット
      if (beat === 0 || beat === 4) noise(0.07, mood.menu ? 0.03 : 0.1, 250, "lowpass", t, g);                   // キック
      const rnd = ((step * 2654435761 + mood.root * 97) >>> 0) % 100;
      if (beat % 2 === 0 || rnd < 40) {                                                                          // メロディ
        const deg = PENTA[((step * 7 + bar * 3 + rnd) >>> 0) % 5] + (rnd % 3 === 0 ? 12 : 0);
        tone(MIDI(base + 12 + deg), spb * 1.5, "square", mood.menu ? 0.03 : 0.045, 0, t, g);
      }
      if (beat % 4 === 2) ch.forEach(n => tone(MIDI(base + n), spb * 1.6, "sine", 0.035, 0, t, g));            // 和音
      step++; nextT += spb;
    }
  }
  function startMusic(m) {
    wantMusic = m; if (!ac) return;
    mood = { ...MOODS[(m.world || 1) - 1], menu: !!m.menu };
    if (mood.menu) mood.bpm = 100;
    if (!timer) { step = 0; nextT = ac.currentTime + 0.1; timer = setInterval(sched, 80); }
  }
  function stopMusic() { wantMusic = null; mood = null; if (timer) { clearInterval(timer); timer = null; } }

  const api = {
    init, play, music: startMusic, stop: stopMusic,
    get sfx() { return st.sfx; }, get bgm() { return st.bgm; },
    setSfx(v) { st.sfx = v; if (sfxG) sfxG.gain.value = v ? 1 : 0; save(); },
    setBgm(v) { st.bgm = v; if (bgmG) bgmG.gain.value = v ? 1 : 0; save(); },
  };
  ["pointerdown", "keydown"].forEach(e => addEventListener(e, () => init(), { once: false, passive: true }));
  return api;
})();
