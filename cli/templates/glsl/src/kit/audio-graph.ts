// DAW の音を受けて解析用の AnalyserNode を出す audio graph。
//
//   main bus      → inputs.main      → [DSP worklet] → monitor gain → destination   (= effect としての passthrough)
//                                             └→ main analyser
//   sidechain bus → inputs.sidechain → sidechain analyser                           (= 解析だけ、音は出さない)
//
// VST runtime では DAW のバスが inputs に繋がる。web runtime では DAW が無いので何も繋がず、
// web-daw (簡易 DAW シミュレーター) が inputs に音を流す。
//
// ⚠️ web runtime では出力を default で mute する (ページを開いただけで音を鳴らさない)。
//   鳴らすのは setMonitor(true) された時だけ。VST runtime は effect plugin なので常に素通し
//   (mute すると DAW のトラックが無音になる)。

import { createDawInput, runtime, type Bus } from '@suara/sdk';

export interface AudioGraphOptions {
  /** main bus に挟む AudioWorklet (省略時は素通し)。DSP を足す時の拡張点。 */
  dsp?: { url: string; processorName: string };
  fftSize?: number;
}

export interface AudioGraph {
  readonly ctx: AudioContext;
  readonly main: AnalyserNode;
  readonly sidechain: AnalyserNode;
  /** 各バスの入口。VST では DAW が繋がっている。web では自分で音を繋ぐ (web-daw が使う)。 */
  readonly inputs: { readonly main: AudioNode; readonly sidechain: AudioNode };
  /** web runtime のみ有効: スピーカーに出すか (VST では常に true)。 */
  readonly monitor: boolean;
  setMonitor(on: boolean): void;
  /** ブラウザの autoplay 制限で止まっている AudioContext を起こす (ユーザー操作の中で呼ぶ)。 */
  resume(): void;
}

function createAnalyser(ctx: AudioContext, fftSize: number): AnalyserNode {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = fftSize;
  // AnalyserNode 内蔵の平滑化は「呼び出し回数」基準で fps 依存になるので切る。
  // 平滑化は signals/audio.ts が秒基準でやる。
  analyser.smoothingTimeConstant = 0;
  return analyser;
}

export async function createAudioGraph(opts: AudioGraphOptions = {}): Promise<AudioGraph> {
  const ctx = new AudioContext();
  const fftSize = opts.fftSize ?? 2048;
  const main = createAnalyser(ctx, fftSize);
  const sidechain = createAnalyser(ctx, fftSize);

  let monitor = runtime.isVst;
  const monitorGain = ctx.createGain();
  monitorGain.gain.value = monitor ? 1 : 0;
  monitorGain.connect(ctx.destination);

  // main bus の入口。DSP があれば挟み、その出力を「出力」と「解析」の両方に配る
  // (= 絵は加工後の音に反応する)。
  const mainIn = ctx.createGain();
  let processed: AudioNode = mainIn;
  if (opts.dsp) {
    await ctx.audioWorklet.addModule(opts.dsp.url);
    const node = new AudioWorkletNode(ctx, opts.dsp.processorName);
    mainIn.connect(node);
    processed = node;
  }
  processed.connect(monitorGain);
  processed.connect(main);

  const sidechainIn = ctx.createGain();
  sidechainIn.connect(sidechain);

  if (runtime.isVst) {
    const attach = async (bus: Bus, to: AudioNode): Promise<void> => {
      const stream = await createDawInput({ bus });
      ctx.createMediaStreamSource(stream).connect(to);
    };
    await attach('main', mainIn);
    try {
      await attach('sidechain', sidechainIn);
    } catch (e) {
      // sidechain が取れなくても絵は出す (suara.json に aux bus が無い等)。値は 0 のまま。
      console.warn('[audio-graph] sidechain input unavailable:', e);
    }
  }
  void ctx.resume();

  return {
    ctx,
    main,
    sidechain,
    inputs: { main: mainIn, sidechain: sidechainIn },
    get monitor() {
      return monitor;
    },
    setMonitor(on) {
      if (runtime.isVst) return;
      monitor = on;
      monitorGain.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02);
    },
    resume() {
      if (ctx.state !== 'running') void ctx.resume();
    },
  };
}
