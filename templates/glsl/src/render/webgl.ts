import type { UniformState } from '../uniforms/layout';

const VERT = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main() { gl_Position = vec4(POS[gl_VertexID], 0.0, 1.0); }
`;

/** Thin wrapper: user fragment provides mainImage(out vec4, in vec2 fragCoord). */
export function wrapFragment(userSrc: string): string {
  return `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float iDelta;
uniform float iBeat;
uniform float iBar;
uniform float iTempo;
uniform float iPlaying;
uniform float iRms;
uniform float iPeak;
uniform float iHit;
uniform float iNoteCount;
uniform float iLastNote;
uniform float iLastVel;
uniform float iScene;
uniform float iP0;
uniform float iP1;
uniform float iP2;
uniform float iP3;
uniform sampler2D iSpectrum;
out vec4 fragColor;
${userSrc}
void main() {
  mainImage(fragColor, gl_FragCoord.xy);
}
`;
}

export type ShaderErrorHandler = (msg: string | null) => void;

export interface WebGlRenderer {
  setFragmentSource(src: string): boolean;
  setUniforms(state: UniformState): void;
  setSpectrum(data: Float32Array): void;
  resize(w: number, h: number): void;
  draw(): void;
  compileOnly(src: string): { ok: true } | { ok: false; log: string };
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | string {
  const sh = gl.createShader(type);
  if (!sh) return 'createShader failed';
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? 'compile failed';
    gl.deleteShader(sh);
    return log;
  }
  return sh;
}

function linkProgram(
  gl: WebGL2RenderingContext,
  vs: WebGLShader,
  fs: WebGLShader,
): WebGLProgram | string {
  const prog = gl.createProgram();
  if (!prog) return 'createProgram failed';
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? 'link failed';
    gl.deleteProgram(prog);
    return log;
  }
  return prog;
}

const UNIFORM_NAMES = [
  'iResolution',
  'iTime',
  'iDelta',
  'iBeat',
  'iBar',
  'iTempo',
  'iPlaying',
  'iRms',
  'iPeak',
  'iHit',
  'iNoteCount',
  'iLastNote',
  'iLastVel',
  'iScene',
  'iP0',
  'iP1',
  'iP2',
  'iP3',
  'iSpectrum',
] as const;

type UniformName = (typeof UNIFORM_NAMES)[number];

export function createWebGlRenderer(
  canvas: HTMLCanvasElement,
  onError?: ShaderErrorHandler,
): WebGlRenderer | null {
  const glOrNull = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!glOrNull) {
    onError?.('WebGL2 not available');
    return null;
  }
  const gl: WebGL2RenderingContext = glOrNull;

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
  if (typeof vs === 'string') {
    onError?.(vs);
    return null;
  }

  let program: WebGLProgram | null = null;
  const locs = new Map<UniformName, WebGLUniformLocation>();
  let spectrumTex: WebGLTexture | null = null;
  let spectrumWidth = 0;
  let state: UniformState | null = null;

  function cacheLocs(prog: WebGLProgram): void {
    locs.clear();
    for (const name of UNIFORM_NAMES) {
      const loc = gl.getUniformLocation(prog, name);
      if (loc) locs.set(name, loc);
    }
  }

  function ensureSpectrum(width: number): void {
    if (spectrumTex && spectrumWidth === width) return;
    if (spectrumTex) gl.deleteTexture(spectrumTex);
    const tex = gl.createTexture();
    if (!tex) return;
    spectrumTex = tex;
    spectrumWidth = width;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, 1, 0, gl.RED, gl.FLOAT, null);
  }

  function u1f(name: UniformName, value: number): void {
    const loc = locs.get(name);
    if (loc) gl.uniform1f(loc, value);
  }

  const api: WebGlRenderer = {
    compileOnly(src: string) {
      const full = wrapFragment(src);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, full);
      if (typeof fs === 'string') return { ok: false, log: fs };
      const prog = linkProgram(gl, vs, fs);
      gl.deleteShader(fs);
      if (typeof prog === 'string') return { ok: false, log: prog };
      gl.deleteProgram(prog);
      return { ok: true };
    },

    setFragmentSource(src: string): boolean {
      const full = wrapFragment(src);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, full);
      if (typeof fs === 'string') {
        onError?.(fs);
        return false;
      }
      const prog = linkProgram(gl, vs, fs);
      gl.deleteShader(fs);
      if (typeof prog === 'string') {
        onError?.(prog);
        return false;
      }
      if (program) gl.deleteProgram(program);
      program = prog;
      cacheLocs(prog);
      onError?.(null);
      return true;
    },

    setUniforms(s: UniformState) {
      state = s;
    },

    setSpectrum(data: Float32Array) {
      ensureSpectrum(data.length);
      if (!spectrumTex) return;
      gl.bindTexture(gl.TEXTURE_2D, spectrumTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, data.length, 1, gl.RED, gl.FLOAT, data);
    },

    resize(w: number, h: number) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.max(1, Math.floor(w * dpr));
      const bh = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);
    },

    draw() {
      if (!program || !state) return;
      gl.useProgram(program);
      const s = state;
      const res = locs.get('iResolution');
      if (res) gl.uniform2f(res, s.iResolutionX, s.iResolutionY);
      u1f('iTime', s.iTime);
      u1f('iDelta', s.iDelta);
      u1f('iBeat', s.iBeat);
      u1f('iBar', s.iBar);
      u1f('iTempo', s.iTempo);
      u1f('iPlaying', s.iPlaying);
      u1f('iRms', s.iRms);
      u1f('iPeak', s.iPeak);
      u1f('iHit', s.iHit);
      u1f('iNoteCount', s.iNoteCount);
      u1f('iLastNote', s.iLastNote);
      u1f('iLastVel', s.iLastVel);
      u1f('iScene', s.iScene);
      u1f('iP0', s.iP0);
      u1f('iP1', s.iP1);
      u1f('iP2', s.iP2);
      u1f('iP3', s.iP3);
      const spec = locs.get('iSpectrum');
      if (spec && spectrumTex) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, spectrumTex);
        gl.uniform1i(spec, 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };

  return api;
}
