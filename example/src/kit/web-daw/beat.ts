// web-daw の内蔵ビート。DAW の代わりに「それっぽい音」を出すための小さなドラムマシン。
//   main      = キック + ハイハット + ベース (トラックの音のつもり)
//   sidechain = キックだけ (キックを Side-Chain に送っているつもり)
// テンポは transport と同じ値を使うので、絵の拍 (iBeat) と合う。

export interface BeatSource {
  readonly main: AudioNode;
  readonly sidechain: AudioNode;
  /** 再生開始。tempo() は毎回呼ぶので、途中で BPM を変えても追従する。 */
  start(tempo: () => number): void;
  stop(): void;
}

const LOOKAHEAD_SEC = 0.15;
const TICK_MS = 50;

export function createBeatSource(ctx: AudioContext): BeatSource {
  const main = ctx.createGain();
  main.gain.value = 0.8;
  const sidechain = ctx.createGain();

  // ハイハット用のノイズ (1 秒ぶんを使い回す)
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  function kick(at: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    gain.gain.setValueAtTime(1, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
    osc.connect(gain);
    gain.connect(main);
    gain.connect(sidechain);
    osc.start(at);
    osc.stop(at + 0.32);
  }

  function hat(at: number, open: boolean): void {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    const len = open ? 0.18 : 0.05;
    gain.gain.setValueAtTime(open ? 0.25 : 0.15, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + len);
    src.connect(filter).connect(gain).connect(main);
    src.start(at);
    src.stop(at + len + 0.02);
  }

  function bass(at: number, freq: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, at);
    filter.frequency.exponentialRampToValueAtTime(120, at + 0.25);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.28);
    osc.connect(filter).connect(gain).connect(main);
    osc.start(at);
    osc.stop(at + 0.3);
  }

  // 8 分音符 1 小節ぶんのパターン
  const BASS_NOTES = [55, 0, 55, 82.4, 0, 55, 73.4, 0];

  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    main,
    sidechain,
    start(tempo) {
      if (timer) return;
      let step = 0;
      let next = ctx.currentTime + 0.05;
      const tick = (): void => {
        while (next < ctx.currentTime + LOOKAHEAD_SEC) {
          const i = step % 8;
          if (i % 2 === 0) kick(next);
          hat(next, i % 2 === 1);
          const note = BASS_NOTES[i] ?? 0;
          if (note > 0) bass(next, note);
          next += 30 / tempo(); // 8 分音符
          step++;
        }
      };
      tick();
      timer = setInterval(tick, TICK_MS);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
