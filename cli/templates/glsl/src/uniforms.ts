// shader から見える uniform の一覧。標準セット + param (pAmount 等) + 自前のもの。
import { paramUniforms, standardUniforms } from './kit/glsl/standard-uniforms';
import type { UniformSpec } from './kit/glsl/renderer';
import type { Frame } from './kit/signals';
import { params, type ParamKey } from './params';

export const uniforms: readonly UniformSpec<Frame<ParamKey>>[] = [
  ...standardUniforms,
  ...paramUniforms(params),
  // 自前の uniform はここに足す。例:
  // { name: 'iKick', type: 'float', get: (f) => f.sidechain.onset },
];
