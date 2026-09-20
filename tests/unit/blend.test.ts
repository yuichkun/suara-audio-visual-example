import { describe, it, expect } from 'vitest';
import { createBlendWeights } from '../../src/kit/signals/blend';

const DT = 1 / 60;
const sum = (w: Float32Array) => w.reduce((a, b) => a + b, 0);

function run(b: ReturnType<typeof createBlendWeights>, value: number, seconds: number, dt = DT) {
  let w = b.update(value, dt);
  for (let i = 1; i < Math.round(seconds / dt); i++) w = b.update(value, dt);
  return Array.from(w);
}

describe('Feature: 値の切り替え → 滑らかに移る重み', () => {
  it('given 最初の値 then morph なしでその選択肢が 1', () => {
    expect(Array.from(createBlendWeights(3, 1).update(2, DT))).toEqual([0, 0, 1]);
  });

  it('given 0 → 1 に切り替え then 途中は両方が混ざり、合計は常に 1、最後は 1 に落ち着く', () => {
    const b = createBlendWeights(3, 1);
    b.update(0, DT);
    const mid = run(b, 1, 0.4);
    expect(mid[0]).toBeGreaterThan(0.05);
    expect(mid[1]).toBeGreaterThan(0.05);
    expect(sum(Float32Array.from(mid))).toBeCloseTo(1, 5);
    const end = run(b, 1, 3);
    expect(end[1]).toBeCloseTo(1, 3);
  });

  it('given 0 → 2 に飛ぶ then 間の 1 は経由しない', () => {
    const b = createBlendWeights(3, 1);
    b.update(0, DT);
    let maxMiddle = 0;
    for (let i = 0; i < 120; i++) maxMiddle = Math.max(maxMiddle, b.update(2, DT)[1] ?? 0);
    expect(maxMiddle).toBe(0);
  });

  it('given 切り替えた直後 then 動き出しは緩やか (S 字)', () => {
    const b = createBlendWeights(2, 1);
    b.update(0, DT);
    const at01 = run(b, 1, 0.1)[1] ?? 0;
    const at02 = run(b, 1, 0.1)[1] ?? 0;
    // 最初の 0.1 秒より、次の 0.1 秒のほうが大きく進む (= 加速しながら動き出す)
    expect(at02 - at01).toBeGreaterThan(at01);
  });

  it('given 小数の値 then 隣り合う 2 つを値どおりに混ぜる', () => {
    const w = run(createBlendWeights(3, 0.5), 1.25, 3);
    expect(w[0]).toBeCloseTo(0, 3);
    expect(w[1]).toBeCloseTo(0.75, 3);
    expect(w[2]).toBeCloseTo(0.25, 3);
  });

  it('given 60fps と 120fps then 同じ秒数で同じ重みになる', () => {
    const at = (dt: number) => {
      const b = createBlendWeights(2, 1);
      b.update(0, dt);
      return run(b, 1, 0.5, dt)[1] ?? 0;
    };
    expect(at(1 / 60)).toBeCloseTo(at(1 / 120), 2);
  });
});
