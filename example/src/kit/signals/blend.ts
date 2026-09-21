// 連続値 (automation param など) → N 個の選択肢それぞれの重み。
//
// 値が切り替わっても重みは瞬時には変わらず、滑らかに移っていく (合計は常に 1)。
// 重みで形や色を混ぜれば、切り替えが必ず morph になる。
//   - 値が整数 i なら、最終的に選択肢 i の重みが 1
//   - 0 → 2 のように飛んでも、間の 1 は経由しない (0 が抜けて 2 が入るだけ)
//   - 値が小数 (automation でなだらかに描いた場合) なら、隣り合う 2 つの間を値どおりに混ぜる

import { smoothingAlpha } from './envelope';

export interface BlendWeights {
  /** 返る配列は毎回同じものを使い回す (長さ = count)。 */
  update(value: number, dt: number): Float32Array<ArrayBuffer>;
}

// 1 次ローパスを 2 段重ねる (= 動き出しと止まり際の両方が滑らかな S 字になる)。
// 2 段で目標の約 95% に届くまでが時定数の約 4.7 倍。
const SETTLE_FACTOR = 4.7;

/** seconds = 切り替えてから morph がほぼ終わるまでの秒数。 */
export function createBlendWeights(count: number, seconds: number): BlendWeights {
  const stage1 = new Float32Array(count);
  const weights = new Float32Array(count);
  const tau = seconds / SETTLE_FACTOR;
  let started = false;

  return {
    update(value, dt) {
      const v = Math.min(count - 1, Math.max(0, value));
      const a = smoothingAlpha(dt, tau);
      for (let i = 0; i < count; i++) {
        const target = Math.max(0, 1 - Math.abs(v - i));
        if (!started) {
          stage1[i] = target;
          weights[i] = target;
          continue;
        }
        const s = (stage1[i] ?? 0) + (target - (stage1[i] ?? 0)) * a;
        stage1[i] = s;
        weights[i] = (weights[i] ?? 0) + (s - (weights[i] ?? 0)) * a;
      }
      started = true;
      return weights;
    },
  };
}
