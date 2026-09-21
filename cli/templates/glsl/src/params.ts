// この plugin の automation param。id / default は suara.json、範囲はここ。
// 足す時: suara.json の parameters に 1 件足す → ここに 1 行足す → shader で p<Key> として使える。
import manifest from '../suara.json';
import { SCENE_SLOTS } from './kit/glsl/scenes';
import { defineParams } from './kit/signals';

export const params = defineParams(manifest.parameters, {
  scene: { title: 'Scene', min: 0, max: SCENE_SLOTS - 1, step: 1 },
  intensity: { title: 'Intensity' },
  hue: { title: 'Hue' },
  speed: { title: 'Speed' },
  audioAmount: { title: 'AudioAmount' },
});

export type ParamKey = keyof typeof params;
