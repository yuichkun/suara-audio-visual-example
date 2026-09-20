// この plugin の automation param。id / default は suara.json、範囲はここ。
// 足す時: suara.json の parameters に 1 件足す → ここに 1 行足す → shader で p<Key> として使える。
// (id が 5 から始まっているのは、使わなくなった param を外した名残。id を詰めると DAW に書いた
//  automation が別の param に当たるので、そのままにしてある)
import manifest from '../suara.json';
import { defineParams } from './kit/signals';

export const params = defineParams(manifest.parameters, {
  // 再生中の形。0 = 割れた球 / 1 = 結晶 / 2 = 輪。間の値は 2 つの形の中間になる
  shape: { title: 'Shape', min: 0, max: 2 },
  // クライマックスのノブ。0 = 平時、上げるほど場面全体が盛り上がる (tuning.energy)
  energy: { title: 'Energy' },
});

export type ParamKey = keyof typeof params;
