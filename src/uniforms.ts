// shader から見える uniform の一覧。標準セット + param (pIntensity 等) + 自前のもの。
import { paramUniforms, standardUniforms } from './kit/glsl/standard-uniforms';
import type { UniformSpec } from './kit/glsl/renderer';
import type { Frame } from './kit/signals';
import { params, type ParamKey } from './params';

/** kit の Frame に、この作品固有の値を足したもの。main.ts が毎フレーム埋める。 */
export type AppFrame = Frame<ParamKey> & {
  /** 4 つ打ちの脈打ち 0..1 (tuning.pulse)。 */
  pulse: number;
};

export const uniforms: readonly UniformSpec<AppFrame>[] = [
  ...standardUniforms,
  ...paramUniforms(params),
  { name: 'iPulse', type: 'float', get: (f) => f.pulse },
];
