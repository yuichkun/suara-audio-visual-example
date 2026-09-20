// shader から見える uniform の一覧。標準セット + param (pIntensity 等) + 自前のもの。
import { paramUniforms, standardUniforms } from './kit/glsl/standard-uniforms';
import type { UniformSpec } from './kit/glsl/renderer';
import type { Frame } from './kit/signals';
import { params, type ParamKey } from './params';

/** kit の Frame に、この作品固有の値を足したもの。main.ts が毎フレーム埋める。 */
export type AppFrame = Frame<ParamKey> & {
  /** 4 つ打ちの脈打ち 0..1 (tuning.pulse)。 */
  pulse: number;
  /** 再生中の形それぞれの重み [割れた球, 結晶, 輪]。合計 1 (tuning.shape)。 */
  shapeWeights: Float32Array;
};

export const uniforms: readonly UniformSpec<AppFrame>[] = [
  ...standardUniforms,
  ...paramUniforms(params),
  { name: 'iPulse', type: 'float', get: (f) => f.pulse },
  { name: 'iShapeWeights', type: 'vec3', get: (f) => f.shapeWeights },
];
