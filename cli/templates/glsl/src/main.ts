import { useMidi, useTransport } from '@suara/sdk';
import { createAudioGraph } from './kit/audio-graph';
import { createGlslRenderer } from './kit/glsl/renderer';
import type { Scene } from './kit/glsl/scenes';
import { createSignals } from './kit/signals';
import { mountWebDaw } from './kit/web-daw';
import { params } from './params';
import { SCENE } from './scenes';
import { uniforms } from './uniforms';
import dspUrl from './worklets/dsp-worklet.ts?worker&url';

async function main(): Promise<void> {
  const canvas = document.getElementById('stage');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#stage canvas required');

  // --- DAW からの入力 ---
  const transport = useTransport();
  const midi = useMidi();
  await midi.whenReady();
  const graph = await createAudioGraph({ dsp: { url: dspUrl, processorName: 'suara-dsp' } });
  const signals = createSignals({ transport, midi, graph, params });
  // ブラウザで開いた時だけ、右下に簡易 DAW シミュレーターが出る (VST では何もしない)
  mountWebDaw({ transport, midi, graph, params, playhead: signals.playhead });

  // --- 描画 ---
  const renderer = createGlslRenderer(canvas, uniforms, {
    onError: (message) => {
      if (message) console.error(message);
    },
  });
  if (!renderer) return;

  let scene = SCENE;
  let current: Scene | null = null;
  const compileIfChanged = (): void => {
    if (scene === current) return;
    current = scene;
    renderer.setFragment(scene.source);
  };
  // .frag を保存したら reload なしで差し替える
  if (import.meta.hot) {
    import.meta.hot.accept('./scenes', (mod) => {
      if (!mod) return;
      scene = mod['SCENE'] as Scene;
      current = null;
    });
  }

  const loop = (nowMs: number): void => {
    const frame = signals.update(nowMs);
    compileIfChanged();
    renderer.draw(frame);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

main().catch((e) => console.error(e));
