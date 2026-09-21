import { describe, it, expect } from 'vitest';
import { createOnsetDetector, follow, smoothTo } from '../../cli/templates/glsl/src/kit/signals/envelope';

/** 同じ秒数を fps 違いで進めた時の結果を返す。 */
function run(fps: number, seconds: number, step: (dt: number) => number): number {
  let v = 0;
  for (let i = 0; i < fps * seconds; i++) v = step(1 / fps);
  return v;
}

describe('Feature: フレームレートに依存しない平滑化', () => {
  it('given 同じ秒数 when 60fps と 120fps で smoothTo then ほぼ同じ値になる', () => {
    let a = 0;
    let b = 0;
    const at60 = run(60, 0.5, (dt) => (a = smoothTo(a, 1, dt, 0.2)));
    const at120 = run(120, 0.5, (dt) => (b = smoothTo(b, 1, dt, 0.2)));
    expect(at60).toBeCloseTo(at120, 6);
    expect(at60).toBeCloseTo(1 - Math.exp(-0.5 / 0.2), 6);
  });

  it('given tau 0 then 即時に target になる', () => {
    expect(smoothTo(0, 1, 1 / 60, 0)).toBe(1);
  });

  it('given attack < release when follow then 上がりは速く下がりは遅い', () => {
    const opts = { attack: 0.01, release: 0.5 };
    const up = follow(0, 1, 0.05, opts);
    const down = follow(1, 0, 0.05, opts);
    expect(up).toBeGreaterThan(0.9);
    expect(down).toBeGreaterThan(0.8);
  });
});

describe('Feature: onset 検出', () => {
  it('given 無音 → 大音量 then 1 に跳ねて減衰する', () => {
    const onset = createOnsetDetector();
    const dt = 1 / 60;
    expect(onset.update(0, dt)).toBe(0);
    expect(onset.update(1, dt)).toBe(1);
    let v = 1;
    for (let i = 0; i < 30; i++) v = onset.update(0, dt);
    expect(v).toBeLessThan(0.1);
  });

  it('given 持続音 then 連続では発火しない', () => {
    const onset = createOnsetDetector();
    const dt = 1 / 60;
    let fires = 0;
    for (let i = 0; i < 120; i++) if (onset.update(0.8, dt) === 1) fires++;
    expect(fires).toBe(1);
  });

  it('given 60fps と 120fps then 減衰の速さは同じ', () => {
    const decayAfter = (fps: number): number => {
      const onset = createOnsetDetector();
      onset.update(0, 1 / fps);
      onset.update(1, 1 / fps);
      let v = 1;
      for (let i = 0; i < fps * 0.2; i++) v = onset.update(1, 1 / fps);
      return v;
    };
    expect(decayAfter(60)).toBeCloseTo(decayAfter(120), 2);
  });
});
