// createDawInput() — DAW audio input を runtime 抽象で供給する。
//   VST runtime: SuaraDawInput(busIndex) (= 段3b 経路、DAW main / sidechain(kAux)
//                bus → MediaStreamTrack)。
//   web runtime: DAW が無いので helper が選んだ仮想源から MediaStream を合成。
//                main = test tone / file、sidechain = 内蔵リズムパルス (= ducking が
//                聞こえるよう default で鳴る key 信号)。
// どちらも userland は `ctx.createMediaStreamSource(stream)` で同じに繋ぐ。

import { runtime } from './runtime';

export type Bus = 'main' | 'sidechain';

export interface DawInputOptions {
  bus?: Bus;
}

export type WebInputSource =
  | { kind: 'tone' }
  | { kind: 'pulse' }
  | { kind: 'file'; file: File };

// per-bus web 仮想源。main = test tone (default)、sidechain = リズムパルス (= ducking
// を自己完結で聞かせる key 信号)。
const webSources: Record<Bus, WebInputSource> = {
  main: { kind: 'tone' },
  sidechain: { kind: 'pulse' },
};

/** web runtime のみ: helper UI が指定 bus の仮想 input 源を差し替える。 */
export function configureWebInput(source: WebInputSource, bus: Bus = 'main'): void {
  webSources[bus] = source;
}

// web 用の共有 AudioContext。bus ごとに new すると context が乱立して browser 上限に
// 当たるため 1 個を lazy に共有する (= VST 経路では使わない)。
let webCtx: AudioContext | null = null;
function getWebCtx(): AudioContext {
  if (!webCtx) webCtx = new AudioContext();
  void webCtx.resume();
  return webCtx;
}

// 内蔵リズムパルス = square tone を ~2.2Hz (≈132 BPM) の square LFO で gate した
// 「四つ打ち」風 key 信号。sidechain ducking が耳で一目瞭然になる。
function buildPulse(ctx: AudioContext, dest: AudioNode): void {
  const tone = ctx.createOscillator();
  tone.type = 'square';
  tone.frequency.value = 70;
  const gate = ctx.createGain();
  gate.gain.value = 0;
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 2.2;
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = 0.5;
  const bias = ctx.createConstantSource();
  bias.offset.value = 0.5; // square -1..1 → gate 0..1
  lfo.connect(lfoAmt).connect(gate.gain);
  bias.connect(gate.gain);
  tone.connect(gate).connect(dest);
  tone.start();
  lfo.start();
  bias.start();
}

export async function createDawInput(opts: DawInputOptions = {}): Promise<MediaStream> {
  const bus: Bus = opts.bus ?? 'main';

  if (runtime.isVst) {
    // 段3b phase3: SuaraDawInput(busIndex) — 0 = main, 1 = sidechain (kAux)。
    const busIndex = bus === 'sidechain' ? 1 : 0;
    return new MediaStream([new SuaraDawInput(busIndex)]);
  }

  // web: helper の選択源を MediaStreamDestination に流す (= destination のみ接続なので
  // それ自体は鳴らず、stream として userland に渡る)。
  const ctx = getWebCtx();
  const dest = ctx.createMediaStreamDestination();
  const src = webSources[bus];

  if (src.kind === 'file') {
    const bytes = await src.file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(bytes);
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    node.connect(dest);
    node.start();
  } else if (src.kind === 'pulse') {
    buildPulse(ctx, dest);
  } else {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 110;
    osc.connect(dest);
    osc.start();
  }
  return dest.stream;
}
