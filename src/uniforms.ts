// shader から見える uniform の一覧。標準セット + param (pShape 等) + この作品固有のもの。
import type { AppFrame } from './app-frame';
import { paramUniforms, standardUniforms } from './kit/glsl/standard-uniforms';
import type { UniformSpec } from './kit/glsl/renderer';
import { params } from './params';

export const uniforms: readonly UniformSpec<AppFrame>[] = [
  ...standardUniforms,
  ...paramUniforms(params),
  { name: 'iPulse', type: 'float', get: (f) => f.pulse },
  { name: 'iShapeWeights', type: 'vec3', get: (f) => f.shapeWeights },
  { name: 'iBass', type: 'float', get: (f) => f.bass },
  { name: 'iBassHitAge', type: 'float', get: (f) => f.bassHitAge },
  { name: 'iBassHit', type: 'float', get: (f) => f.bassHit },
  { name: 'iHallAngle', type: 'float', get: (f) => f.hallAngle },
];
