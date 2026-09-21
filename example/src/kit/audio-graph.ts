// DAW の音を受けて解析用の AnalyserNode を出す audio graph。
//
//   main bus      → [DSP worklet] → monitor gain → destination   (= effect としての passthrough)
//                          └→ main analyser
//   sidechain bus → sidechain analyser                           (= 解析だけ、音は出さない)
//
// ⚠️ web runtime では出力を default で mute する。SDK の web 用仮想入力は test tone なので、
//   素通しするとページを開いただけで音が鳴る。鳴らすのは setMonitor(true) された時だけ。
//   VST runtime は effect plugin なので常に素通し (mute すると DAW のトラックが無音になる)。

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
  /** web runtime のみ有効: スピーカーに出すか (VST では常に true)。 */
  readonly monitor: boolean;
  setMonitor(on: boolean): void;
  /** 入力を取り直す (web runtime で configureWebInput した後に呼ぶ)。 */
  reloadInputs(): Promise<void>;
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

  const sources = new Map<Bus, { node: MediaStreamAudioSourceNode; stream: MediaStream }>();

  async function attach(bus: Bus): Promise<void> {
    const prev = sources.get(bus);
    if (prev) {
      prev.node.disconnect();
      if (runtime.isWeb) for (const t of prev.stream.getTracks()) t.stop();
      sources.delete(bus);
    }
    const stream = await createDawInput({ bus });
    const node = ctx.createMediaStreamSource(stream);
    node.connect(bus === 'main' ? mainIn : sidechain);
    sources.set(bus, { node, stream });
  }

  await attach('main');
  try {
    await attach('sidechain');
  } catch (e) {
    // sidechain が取れなくても絵は出す (suara.json に aux bus が無い等)。値は 0 のまま。
    console.warn('[audio-graph] sidechain input unavailable:', e);
  }

  void ctx.resume();
  if (runtime.isWeb) resumeOnGesture();

  // ブラウザの autoplay 制限: 操作前に作った AudioContext は suspended のまま。
  // 最初の操作で resume し、SDK 側の仮想入力 (別 context) も取り直して起こす。
  function resumeOnGesture(): void {
    const onGesture = (): void => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      if (ctx.state === 'running') return; // autoplay が許可されていた
      void ctx.resume();
      void graph.reloadInputs();
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
  }

  const graph: AudioGraph = {
    ctx,
    main,
    sidechain,
    get monitor() {
      return monitor;
    },
    setMonitor(on) {
      if (runtime.isVst) return;
      monitor = on;
      monitorGain.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02);
    },
    async reloadInputs() {
      await attach('main');
      await attach('sidechain').catch(() => undefined);
    },
  };
  return graph;
}
