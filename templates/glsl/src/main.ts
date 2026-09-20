import { runtime, useMidi, useTransport } from '@suara/sdk';
import { createAudioGraph, type AudioGraph } from './audio/graph';
import { analyseTimeDomain, binsToTextureData, createHitTracker } from './audio/spectrum';
import { createWebClock, packClock } from './daw/clock';
import { mapMidiToUniforms } from './daw/midi';
import { createParams } from './daw/params';
import { createWebGlRenderer } from './render/webgl';
import { SCENES, sceneIndexFromParam } from './scenes';
import { createUniformState } from './uniforms/layout';
import { derive } from './uniforms/derive';
import { mountHud } from './web/hud';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const hudEl = document.getElementById('hud') as HTMLDivElement;

function setError(msg: string | null): void {
  errorEl.textContent = msg ?? '';
}

async function main(): Promise<void> {
  const transport = useTransport();
  const midi = useMidi();
  await midi.whenReady();
  const params = createParams();

  let lastNote = 0;
  let lastVel = 0;
  midi.on('noteon', (e) => {
    lastNote = e.note;
    lastVel = e.velocity;
  });

  const webClock = createWebClock();
  const renderer = createWebGlRenderer(canvas, setError);
  if (!renderer) return;

  let currentScene = -1;
  function ensureScene(idx: number): void {
    if (idx === currentScene) return;
    currentScene = idx;
    renderer.setFragmentSource(SCENES[idx] ?? SCENES[0]);
  }
  ensureScene(0);

  if (import.meta.hot) {
    import.meta.hot.accept('./scenes/index.ts', () => {
      currentScene = -1;
      ensureScene(sceneIndexFromParam(params.scene.value));
    });
  }

  let graph: AudioGraph = await createAudioGraph();
  const hit = createHitTracker();
  let spectrum = new Float32Array(graph.freqBuf.length);
  const uniforms = createUniformState();

  mountHud(hudEl, {
    transport,
    midi,
    onPlayChange: (playing) => webClock.setPlaying(playing),
    onAudioFile: async () => {
      const ctx = graph.ctx;
      graph.dispose();
      graph = await createAudioGraph(ctx);
      spectrum = new Float32Array(graph.freqBuf.length);
    },
  });

  let lastTs = performance.now();

  function frame(ts: number): void {
    const dt = Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;

    const st = transport.state;
    webClock.setPlaying(st.isPlaying);
    if (runtime.isWeb || st.positionSamples === 0) {
      webClock.tick(dt);
    }

    const clock =
      !runtime.isWeb && st.positionSamples > 0
        ? packClock({
            positionSamples: st.positionSamples,
            sampleRate: graph.ctx.sampleRate,
            tempo: st.tempo,
            timeSigNum: st.timeSigNum,
            isPlaying: st.isPlaying,
          })
        : webClock.pack({ tempo: st.tempo, timeSigNum: st.timeSigNum });

    graph.analyser.getFloatTimeDomainData(graph.timeBuf);
    graph.analyser.getByteFrequencyData(graph.freqBuf);
    const td = analyseTimeDomain(graph.timeBuf);
    binsToTextureData(graph.freqBuf, spectrum);
    const iHit = hit.update(td.rms);

    const midiU = mapMidiToUniforms({
      activeNotes: midi.activeNotes,
      lastNote,
      lastVel,
    });

    const sceneIdx = sceneIndexFromParam(params.scene.value);
    ensureScene(sceneIdx);

    Object.assign(uniforms, clock, midiU, {
      iResolutionX: canvas.width,
      iResolutionY: canvas.height,
      iDelta: dt,
      iRms: td.rms,
      iPeak: td.peak,
      iHit,
      iScene: sceneIdx,
      iP0: params.intensity.value,
      iP1: params.hue.value,
      iP2: params.speed.value,
      iP3: params.audioAmount.value,
    });

    const finalState = derive(uniforms);
    renderer.resize(canvas.clientWidth, canvas.clientHeight);
    finalState.iResolutionX = canvas.width;
    finalState.iResolutionY = canvas.height;
    renderer.setSpectrum(spectrum);
    renderer.setUniforms(finalState);
    renderer.draw();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main().catch((e) => {
  setError(String(e));
  console.error(e);
});
