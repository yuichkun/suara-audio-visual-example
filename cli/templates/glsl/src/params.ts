// automation param。id / default は suara.json、範囲はここ。
// 足す時: suara.json の parameters に 1 件足す → ここに 1 行足す → shader で p<Key> として使える。
import manifest from '../suara.json';
import { defineParams } from './kit/signals';

export const params = defineParams(manifest.parameters, {
  amount: { title: 'Amount' },
});

export type ParamKey = keyof typeof params;
