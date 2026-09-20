import { createWebGlRenderer } from './render/webgl';
import { createUniformState } from './uniforms/layout';
import { SCENES } from './scenes';
import probeSrc from '../tests/e2e/probe.frag?raw';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = createWebGlRenderer(canvas);
if (!renderer) throw new Error('no webgl2');

const state = createUniformState();

(window as unknown as { __suaraHarness: unknown }).__suaraHarness = {
  compileScenes(): Array<{ index: number; ok: boolean; log?: string }> {
    return SCENES.map((src, index) => {
      const r = renderer.compileOnly(src);
      return r.ok ? { index, ok: true } : { index, ok: false, log: r.log };
    });
  },
  drawProbe(partial: Partial<typeof state>): number[] {
    Object.assign(state, partial);
    renderer.setFragmentSource(probeSrc);
    renderer.setUniforms(state);
    renderer.resize(64, 64);
    // resize may change canvas size via dpr — force exact size for readPixels
    canvas.width = 64;
    canvas.height = 64;
    state.iResolutionX = 64;
    state.iResolutionY = 64;
    const gl = canvas.getContext('webgl2')!;
    gl.viewport(0, 0, 64, 64);
    renderer.draw();
    const px = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [...px];
  },
  setScene(index: number): void {
    renderer.setFragmentSource(SCENES[index] ?? SCENES[0]);
  },
};
