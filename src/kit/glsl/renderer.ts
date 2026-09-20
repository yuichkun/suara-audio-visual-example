// WebGL2 の fullscreen fragment renderer (Shadertoy 風: shader は mainImage を書くだけ)。
//
// uniform は UniformSpec の表 1 つで宣言する。表から GLSL の宣言と毎フレームの upload の
// 両方が生成されるので、uniform を足す時に触るのは表の 1 行だけ。
// iResolution だけは renderer 自身が知っている値なので built-in。

export type UniformSpec<F> =
  | { name: string; type: 'float'; get(frame: F): number }
  | { name: string; type: 'vec2' | 'vec3' | 'vec4'; get(frame: F): readonly number[] }
  /** 1 行 × N 列の float texture (R16F)。shader では texture() / texelFetch() で読む。 */
  | { name: string; type: 'texture'; get(frame: F): Float32Array };

const VERT = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main() { gl_Position = vec4(POS[gl_VertexID], 0.0, 1.0); }
`;

function glslType(type: UniformSpec<unknown>['type']): string {
  return type === 'texture' ? 'sampler2D' : type;
}

/** user の .frag を完全な fragment shader にする。`#line 1` でエラー行番号を .frag に合わせる。 */
export function buildFragmentSource<F>(
  userSrc: string,
  uniforms: readonly UniformSpec<F>[],
): string {
  const decls = uniforms.map((u) => `uniform ${glslType(u.type)} ${u.name};`).join('\n');
  return `#version 300 es
precision highp float;
uniform vec3 iResolution;
${decls}
out vec4 suaraFragColor;
#line 1
${userSrc}
void main() {
  mainImage(suaraFragColor, gl_FragCoord.xy);
}
`;
}

export type CompileResult = { ok: true } | { ok: false; log: string };

export interface GlslRenderer<F> {
  /** 失敗したら前の shader を維持して false。エラーは onError に出る。 */
  setFragment(src: string): boolean;
  /** 描画せずにコンパイルだけ試す。 */
  compileOnly(src: string): CompileResult;
  draw(frame: F): void;
}

export interface GlslRendererOptions {
  onError?: (message: string | null) => void;
  /** devicePixelRatio の上限 (重い shader 用)。default 2。 */
  maxPixelRatio?: number;
  /** canvas の中身を後から readPixels したい時だけ true (テスト用)。 */
  preserveDrawingBuffer?: boolean;
}

export function createGlslRenderer<F>(
  canvas: HTMLCanvasElement,
  uniforms: readonly UniformSpec<F>[],
  opts: GlslRendererOptions = {},
): GlslRenderer<F> | null {
  const { onError } = opts;
  const maxPixelRatio = opts.maxPixelRatio ?? 2;
  const ctx = canvas.getContext('webgl2', {
    antialias: false,
    preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
  });
  if (!ctx) {
    onError?.('WebGL2 not available');
    return null;
  }
  const gl: WebGL2RenderingContext = ctx;

  function compile(type: number, src: string): WebGLShader | string {
    const sh = gl.createShader(type);
    if (!sh) return 'createShader failed';
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      // driver によっては log の末尾に NUL が付く
      const log = (gl.getShaderInfoLog(sh) ?? 'compile failed').replaceAll('\0', '').trim();
      gl.deleteShader(sh);
      return log;
    }
    return sh;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  if (typeof vs === 'string') {
    onError?.(vs);
    return null;
  }

  function link(userSrc: string): WebGLProgram | string {
    const fs = compile(gl.FRAGMENT_SHADER, buildFragmentSource(userSrc, uniforms));
    if (typeof fs === 'string') return fs;
    const prog = gl.createProgram();
    if (!prog) return 'createProgram failed';
    gl.attachShader(prog, vs as WebGLShader);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) ?? 'link failed';
      gl.deleteProgram(prog);
      return log;
    }
    return prog;
  }

  // texture uniform ごとに texture unit を 1 つ固定で割り当てる
  interface TextureSlot {
    unit: number;
    tex: WebGLTexture | null;
    width: number;
  }
  const textures = new Map<string, TextureSlot>();
  for (const u of uniforms) {
    if (u.type === 'texture') textures.set(u.name, { unit: textures.size, tex: null, width: 0 });
  }

  function uploadTexture(slot: TextureSlot, data: Float32Array): void {
    gl.activeTexture(gl.TEXTURE0 + slot.unit);
    if (!slot.tex || slot.width !== data.length) {
      if (slot.tex) gl.deleteTexture(slot.tex);
      slot.tex = gl.createTexture();
      slot.width = data.length;
      gl.bindTexture(gl.TEXTURE_2D, slot.tex);
      // R16F は拡張なしで LINEAR filter できる (R32F は OES_texture_float_linear が要る)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, data.length, 1, 0, gl.RED, gl.FLOAT, data);
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, slot.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, data.length, 1, gl.RED, gl.FLOAT, data);
  }

  let program: WebGLProgram | null = null;
  let resolutionLoc: WebGLUniformLocation | null = null;
  // 現在の program で実際に使われている uniform だけ (未使用は GLSL コンパイラが消す)
  let active: Array<{ spec: UniformSpec<F>; loc: WebGLUniformLocation }> = [];

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  }

  return {
    compileOnly(src) {
      const prog = link(src);
      if (typeof prog === 'string') return { ok: false, log: prog };
      gl.deleteProgram(prog);
      return { ok: true };
    },

    setFragment(src) {
      const prog = link(src);
      if (typeof prog === 'string') {
        onError?.(prog);
        return false;
      }
      if (program) gl.deleteProgram(program);
      program = prog;
      resolutionLoc = gl.getUniformLocation(prog, 'iResolution');
      active = [];
      for (const spec of uniforms) {
        const loc = gl.getUniformLocation(prog, spec.name);
        if (loc) active.push({ spec, loc });
      }
      onError?.(null);
      return true;
    },

    draw(frame) {
      if (!program) return;
      resize();
      gl.useProgram(program);
      if (resolutionLoc) gl.uniform3f(resolutionLoc, canvas.width, canvas.height, 1);
      for (const { spec, loc } of active) {
        if (spec.type === 'float') {
          gl.uniform1f(loc, spec.get(frame));
        } else if (spec.type === 'texture') {
          const slot = textures.get(spec.name);
          if (!slot) continue;
          uploadTexture(slot, spec.get(frame));
          gl.uniform1i(loc, slot.unit);
        } else {
          const v = spec.get(frame);
          if (spec.type === 'vec2') gl.uniform2f(loc, v[0] ?? 0, v[1] ?? 0);
          else if (spec.type === 'vec3') gl.uniform3f(loc, v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
          else gl.uniform4f(loc, v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, v[3] ?? 0);
        }
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
