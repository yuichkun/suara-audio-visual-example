import { createDawInput } from '@suara/sdk';
import workletUrl from '../worklets/dsp-worklet.ts?worker&url';

export interface AudioGraph {
  ctx: AudioContext;
  analyser: AnalyserNode;
  timeBuf: Float32Array;
  freqBuf: Uint8Array;
  dispose(): void;
}

export async function createAudioGraph(existing?: AudioContext): Promise<AudioGraph> {
  const ctx = existing ?? new AudioContext();
  await ctx.audioWorklet.addModule(workletUrl);
  const stream = await createDawInput({ bus: 'main' });
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'suara-dsp');
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.7;
  source.connect(node);
  node.connect(analyser);
  analyser.connect(ctx.destination);
  void ctx.resume();
  return {
    ctx,
    analyser,
    timeBuf: new Float32Array(analyser.fftSize),
    freqBuf: new Uint8Array(analyser.frequencyBinCount),
    dispose() {
      try {
        source.disconnect();
        node.disconnect();
        analyser.disconnect();
      } catch {
        /* already disconnected */
      }
    },
  };
}
