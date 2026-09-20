// この作品の shader。(kit には Scene param で複数の shader を切り替える仕組みもあるが、
// この作品は 1 本だけなので使っていない)
import source from './shaders/main.frag?raw';
import type { Scene } from './kit/glsl/scenes';

export const SCENE: Scene = { name: 'main', source };
