import { describe, it, expect } from 'vitest';
import {
  beatsPerBar,
  createBeatTracker,
  createStepTrigger,
  phase,
  pulse,
  type PlayheadSample,
} from '../../cli/templates/glsl/src/kit/signals/transport';

const at = (seconds: number, over: Partial<PlayheadSample> = {}): PlayheadSample => ({
  seconds,
  playing: true,
  tempo: 120,
  timeSigNum: 4,
  timeSigDenom: 4,
  ...over,
});

describe('Feature: 再生位置 → beat / bar', () => {
  it('given 120BPM 4/4 の 4 秒地点 then beat 8 / bar 2', () => {
    const f = createBeatTracker().update(at(4), 0);
    expect(f.songTime).toBe(4);
    expect(f.beat).toBe(8);
    expect(f.bar).toBe(2);
    expect(f.beatPhase).toBe(0);
    expect(f.jumped).toBe(false);
  });

  it('given 6/8 then 1 小節は 4 分音符 3 つぶん', () => {
    expect(beatsPerBar(6, 8)).toBe(3);
    const f = createBeatTracker().update(at(3, { timeSigNum: 6, timeSigDenom: 8 }), 0);
    expect(f.beat).toBe(6);
    expect(f.bar).toBe(2);
  });

  it('given 再生中にテンポが 120 → 60 に変わる then beat は飛ばずに新テンポで進む', () => {
    const t = createBeatTracker();
    const dt = 1 / 60;
    t.update(at(10), dt);
    const before = t.update(at(10 + dt), dt).beat;
    const after = t.update(at(10 + 2 * dt, { tempo: 60 }), dt).beat;
    // 素朴な seconds * tempo / 60 だと 20 → 10 に飛ぶ
    expect(after - before).toBeCloseTo((dt * 120) / 60, 6);
    const later = t.update(at(11 + 2 * dt, { tempo: 60 }), 1).beat;
    expect(later - after).toBeCloseTo(1, 6);
  });

  it('given loop で位置が戻る then jumped が立って beat が付け直される', () => {
    const t = createBeatTracker();
    t.update(at(8), 1 / 60);
    const f = t.update(at(2), 1 / 60);
    expect(f.jumped).toBe(true);
    expect(f.beat).toBe(4);
  });

  it('given 停止中 then beat は進まない', () => {
    const t = createBeatTracker();
    const a = t.update(at(3, { playing: false }), 1 / 60);
    const b = t.update(at(3, { playing: false }), 1 / 60);
    expect(b.beat).toBe(a.beat);
    expect(b.playing).toBe(false);
  });
});

describe('Feature: テンポ同期の部品', () => {
  it('phase は周期で 0..1 に畳む', () => {
    expect(phase(5, 4)).toBe(0.25);
    expect(phase(0.25, 0.5)).toBe(0.5);
  });

  it('pulse は周期の頭で 1、以後減衰', () => {
    expect(pulse(4, 1)).toBe(1);
    expect(pulse(4.5, 1)).toBeLessThan(0.1);
  });

  it('step trigger は境界を跨いだフレームだけ true', () => {
    const trig = createStepTrigger(1);
    const fired = [0.2, 0.6, 1.1, 1.5, 2.01].map((beat) => trig.update({ beat, playing: true }));
    expect(fired).toEqual([false, false, true, false, true]);
  });

  it('step trigger は停止中は発火しない', () => {
    const trig = createStepTrigger(1);
    trig.update({ beat: 0.5, playing: false });
    expect(trig.update({ beat: 1.5, playing: false })).toBe(false);
  });
});
