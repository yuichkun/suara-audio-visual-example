import { describe, it, expect } from 'vitest';
import {
  analyseTimeDomain,
  bandAverage,
  createAudioAnalysis,
  type AnalyserLike,
} from '../../cli/templates/glsl/src/kit/signals/audio';

function fakeAnalyser(): AnalyserLike & { wave: Float32Array; bins: Uint8Array } {
  const wave = new Float32Array(2048);
  const bins = new Uint8Array(1024);
  return {
    wave,
    bins,
    fftSize: 2048,
    frequencyBinCount: 1024,
    context: { sampleRate: 48000 },
    getFloatTimeDomainData: (out) => out.set(wave),
    getByteFrequencyData: (out) => out.set(bins),
  };
}

const DT = 1 / 60;

describe('Feature: 波形 → rms / peak', () => {
  it('given 無音 then 0', () => {
    expect(analyseTimeDomain(new Float32Array(512))).toEqual({ rms: 0, peak: 0 });
  });

  it('given full-scale の sine then peak ≈ 1、rms ≈ 0.707', () => {
    const buf = Float32Array.from({ length: 512 }, (_, i) => Math.sin((2 * Math.PI * i) / 512));
    const out = analyseTimeDomain(buf);
    expect(out.peak).toBeGreaterThan(0.99);
    expect(out.rms).toBeCloseTo(Math.SQRT1_2, 2);
  });
});

describe('Feature: spectrum → 帯域', () => {
  it('bandAverage は指定 Hz 範囲のビンだけを平均する', () => {
    const spectrum = new Float32Array(100);
    spectrum.fill(1, 0, 10);
    // 1 ビン = 10Hz → 0..100Hz は全部 1、100..200Hz は全部 0
    expect(bandAverage(spectrum, 10, 0, 100)).toBe(1);
    expect(bandAverage(spectrum, 10, 100, 200)).toBe(0);
    expect(bandAverage(spectrum, 10, 50, 150)).toBe(0.5);
  });

  it('given 低域だけ鳴っている then low が立って high は 0', () => {
    const a = fakeAnalyser();
    // 48kHz / 1024 ビン → 1 ビン ≈ 23.4Hz。0..8 ビン ≈ 0..190Hz
    a.bins.fill(255, 0, 8);
    const analysis = createAudioAnalysis(a);
    let f = analysis.update(DT);
    for (let i = 0; i < 5; i++) f = analysis.update(DT);
    expect(f.low).toBeGreaterThan(0.8);
    expect(f.high).toBe(0);
    expect(f.spectrum[0]).toBe(1);
  });
});

describe('Feature: AudioFrame', () => {
  it('given 音が鳴り始める then level が追従し onset が跳ねる', () => {
    const a = fakeAnalyser();
    const analysis = createAudioAnalysis(a);
    expect(analysis.update(DT).level).toBe(0);
    a.wave.fill(0.5);
    const first = analysis.update(DT);
    expect(first.rms).toBeCloseTo(0.5, 6);
    expect(first.onset).toBe(1);
    let f = first;
    for (let i = 0; i < 30; i++) f = analysis.update(DT);
    expect(f.level).toBeCloseTo(0.5, 2);
    expect(f.onset).toBeLessThan(0.1);
    expect(f.waveform[0]).toBe(0.5);
  });
});
