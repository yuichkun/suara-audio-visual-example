import { useMidi, useTransport } from '@suara/sdk';
import { createAudioGraph } from './kit/audio-graph';
import { createGlslRenderer } from './kit/glsl/renderer';
import { sceneForValue, type Scene } from './kit/glsl/scenes';
import { createSignals, pulse } from './kit/signals';
import { params } from './params';
import { SCENES } from './scenes';
import { tuning } from './tuning';
import { uniforms, type AppFrame } from './uniforms';
import dspUrl from './worklets/dsp-worklet.ts?worker&url';

async function main(): Promise<void> {
  const canvas = document.getElementById('stage');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#stage canvas required');

  // --- DAW からの入力 (web では SDK が仮想化する) ---
  const transport = useTransport();
  const midi = useMidi();
  await midi.whenReady();
  const graph = await createAudioGraph({ dsp: { url: dspUrl, processorName: 'suara-dsp' } });
  const signals = createSignals({ transport, midi, graph, params, motionEase: tuning.motion });

  // --- 描画 ---
  const renderer = createGlslRenderer(canvas, uniforms, {
    constants: tuning.shader,
    onError: (message) => {
      if (message) console.error(message);
    },
  });
  if (!renderer) return;

  let tune = tuning;
  let scenes = SCENES;
  let current: Scene | null = null;
  const showScene = (scene: Scene | null): void => {
    if (!scene || scene === current) return;
    current = scene;
    renderer.setFragment(scene.source);
  };
  // .frag / tuning.ts を保存したら reload なしで差し替える
  if (import.meta.hot) {
    import.meta.hot.accept('./tuning', (mod) => {
      if (!mod) return;
      tune = mod['tuning'] as typeof tuning;
      renderer.setConstants(tune.shader);
      current = null;
    });
    import.meta.hot.accept('./scenes', (mod) => {
      if (!mod) return;
      scenes = mod['SCENES'] as readonly Scene[];
      current = null;
    });
  }

  const loop = (nowMs: number): void => {
    const frame = signals.update(nowMs) as AppFrame;
    const { beat, playing } = frame.transport;
    frame.pulse = playing ? pulse(beat, tune.pulse.cycleBeats, tune.pulse.sharpness) : 0;
    showScene(sceneForValue(scenes, frame.params.scene));
    renderer.draw(frame);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

main().catch((e) => console.error(e));
