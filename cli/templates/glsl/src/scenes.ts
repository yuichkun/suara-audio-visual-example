// src/shaders/*.frag がファイル名順に Scene 0, 1, 2... になる (置くだけで増える)。
import { scenesFromGlob, type Scene } from './kit/glsl/scenes';

export const SCENES: readonly Scene[] = scenesFromGlob(
  import.meta.glob<string>('./shaders/*.frag', { query: '?raw', import: 'default', eager: true }),
);
