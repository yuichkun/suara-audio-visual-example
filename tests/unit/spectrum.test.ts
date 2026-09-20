import { describe, it, expect } from 'vitest';
import { analyseTimeDomain, createHitTracker } from '../../src/audio/spectrum';

describe('Feature: audio buffer → rms / spectrum', () => {
  it('given silence then rms 0', () => {
    const buf = new Float32Array(512);
    const out = analyseTimeDomain(buf);
    expect(out.rms).toBe(0);
    expect(out.peak).toBe(0);
  });

  it('given full-scale sine then peak near 1', () => {
    const buf = new Float32Array(512);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = Math.sin((2 * Math.PI * i) / buf.length);
    }
    const out = analyseTimeDomain(buf);
    expect(out.peak).toBeGreaterThan(0.99);
    expect(out.rms).toBeGreaterThan(0.5);
  });

  it('given a transient then iHit pulses and decays', () => {
    const hit = createHitTracker();
    const silent = new Float32Array(128);
    const loud = new Float32Array(128);
    loud.fill(1);

    expect(hit.update(analyseTimeDomain(silent).rms)).toBe(0);
    const pulsed = hit.update(analyseTimeDomain(loud).rms);
    expect(pulsed).toBeGreaterThan(0.5);
    let v = pulsed;
    for (let i = 0; i < 30; i++) v = hit.update(0);
    expect(v).toBeLessThan(pulsed);
    expect(v).toBeLessThan(0.1);
  });
});
