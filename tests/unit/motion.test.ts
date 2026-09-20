import { describe, it, expect } from 'vitest';
import { createMotion } from '../../src/kit/signals/motion';

const DT = 1 / 60;

function run(motion: ReturnType<typeof createMotion>, on: boolean, seconds: number, dt = DT) {
  let f = motion.update(on, 0);
  for (let i = 0; i < Math.round(seconds / dt); i++) f = motion.update(on, dt);
  return { ...f };
}

describe('Feature: 「いま動くべきか」のスイッチ', () => {
  it('given ずっと off then amount も time も 0 のまま', () => {
    expect(run(createMotion(), false, 2)).toEqual({ on: false, amount: 0, time: 0 });
  });

  it('given on にする then amount は滑らかに 1 へ、time が進み始める', () => {
    const m = createMotion();
    const early = run(m, true, 0.1);
    expect(early.amount).toBeGreaterThan(0);
    expect(early.amount).toBeLessThan(0.5);
    const later = run(m, true, 5);
    expect(later.amount).toBe(1);
    expect(later.time).toBeGreaterThan(4);
  });

  it('given off に戻す then 減速して止まり、time は飛ばずにそこで止まる', () => {
    const m = createMotion();
    run(m, true, 5);
    const stopping = run(m, false, 0.2);
    expect(stopping.amount).toBeLessThan(1);
    expect(stopping.amount).toBeGreaterThan(0);
    const stopped = run(m, false, 10);
    expect(stopped.amount).toBe(0);
    expect(stopped.time).toBeGreaterThan(stopping.time);
    expect(run(m, false, 1).time).toBe(stopped.time);
  });

  it('given 再開 then time は 0 に戻らず続きから進む', () => {
    const m = createMotion();
    const first = run(m, true, 3).time;
    run(m, false, 10);
    expect(run(m, true, 1).time).toBeGreaterThan(first);
  });

  it('given 60fps と 120fps then 同じ秒数で同じ amount になる', () => {
    const a = run(createMotion(), true, 0.4, 1 / 60).amount;
    const b = run(createMotion(), true, 0.4, 1 / 120).amount;
    expect(a).toBeCloseTo(b, 6);
  });
});
