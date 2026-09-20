// e2e (Playwright) 用: renderer を素の状態で叩く窓口。plugin 本体には含まれない。
import { createGlslRenderer, type CompileResult, type UniformSpec } from './kit/glsl/renderer';
import { standardUniforms } from './kit/glsl/standard-uniforms';
import { SCENE } from './scenes';
import { tuning } from './tuning';
import { uniforms } from './uniforms';
import probeSrc from '../tests/e2e/probe.frag?raw';

const canvas = document.getElementById('c');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#c canvas required');

interface Probe {
  a: number;
  b: number;
  tex: number[];
}
const probeUniforms: UniformSpec<Probe>[] = [
  { name: 'uA', type: 'float', get: (p) => p.a },
  { name: 'uB', type: 'vec2', get: (p) => [p.b, 0] },
  { name: 'uTex', type: 'texture', get: (p) => new Float32Array(p.tex) },
];

export interface HarnessApi {
  compileScenes(): Array<{ name: string } & CompileResult>;
  compileSource(src: string): CompileResult;
  drawProbe(probe: Probe): number[];
  uniformNames(): string[];
}

const api: HarnessApi = {
  compileScenes() {
    const r = createGlslRenderer(document.createElement('canvas'), uniforms, {
      constants: tuning.shader,
    });
    if (!r) throw new Error('no webgl2');
    return [SCENE].map((s) => ({ name: s.name, ...r.compileOnly(s.source) }));
  },
  compileSource(src) {
    const r = createGlslRenderer(document.createElement('canvas'), standardUniforms);
    if (!r) throw new Error('no webgl2');
    return r.compileOnly(src);
  },
  drawProbe(probe) {
    const r = createGlslRenderer(canvas, probeUniforms, { preserveDrawingBuffer: true });
    if (!r) throw new Error('no webgl2');
    if (!r.setFragment(probeSrc)) throw new Error('probe.frag failed to compile');
    r.draw(probe);
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('no webgl2');
    const px = new Uint8Array(4);
    gl.readPixels(canvas.width >> 1, canvas.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [...px];
  },
  uniformNames: () => uniforms.map((u) => u.name),
};

(window as unknown as { __suaraHarness: HarnessApi }).__suaraHarness = api;
