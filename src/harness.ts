import { createWebGlRenderer } from './render/webgl';
import { createUniformState } from './uniforms/layout';
import { SCENES, sceneSource } from './scenes';
import probeSrc from '../tests/e2e/probe.frag?raw';

const canvasEl = document.getElementById('c');
if (!(canvasEl instanceof HTMLCanvasElement)) throw new Error('#c canvas required');
const canvas = canvasEl;

const maybe = createWebGlRenderer(canvas);
if (!maybe) throw new Error('no webgl2');
const renderer = maybe;

const state = createUniformState();

export type HarnessApi = {
  compileScenes: () => Array<{ index: number; ok: boolean; log?: string }>;
  compileSource: (src: string) => { ok: true } | { ok: false; log: string };
  drawProbe: (partial: Partial<typeof state>) => number[];
  setScene: (index: number) => void;
};

const api: HarnessApi = {
  compileScenes() {
    return SCENES.map((src, index) => {
      const r = renderer.compileOnly(src);
      return r.ok ? { index, ok: true } : { index, ok: false, log: r.log };
    });
  },
  compileSource(src: string) {
    return renderer.compileOnly(src);
  },
  drawProbe(partial) {
    Object.assign(state, partial);
    renderer.setFragmentSource(probeSrc);
    renderer.setUniforms(state);
    renderer.resize(64, 64);
    canvas.width = 64;
    canvas.height = 64;
    state.iResolutionX = 64;
    state.iResolutionY = 64;
    const gl = canvas.getContext('webgl2');
    if (!gl) return [0, 0, 0, 0];
    gl.viewport(0, 0, 64, 64);
    renderer.draw();
    const px = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [px[0] ?? 0, px[1] ?? 0, px[2] ?? 0, px[3] ?? 0];
  },
  setScene(index: number) {
    renderer.setFragmentSource(sceneSource(index));
  },
};

(window as unknown as { __suaraHarness: HarnessApi }).__suaraHarness = api;
