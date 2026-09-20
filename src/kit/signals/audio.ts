// AnalyserNode → 絵に使いやすい値。main bus にも sidechain bus にも同じものを使う。

import {
  createOnsetDetector,
  follow,
  type FollowerOptions,
  type OnsetOptions,
} from './envelope';

export interface AudioFrame {
  /** このフレームの RMS (生値、0..1)。 */
  rms: number;
  /** このフレームの絶対値ピーク (生値、0..1)。 */
  peak: number;
  /** rms を envelope follower で均したもの。「音量」として普通はこれを使う。 */
  level: number;
  /** 帯域ごとのエネルギー (0..1)。 */
  low: number;
  mid: number;
  high: number;
  /** 立ち上がりで 1、以後減衰 (0..1)。全帯域の音量で見る。 */
  onset: number;
  /** onset の低域版 (low の立ち上がり)。mix の中からキックを拾いたい時に使う。 */
  lowOnset: number;
  /** 周波数ビン (0..1、低 → 高、線形周波数)。 */
  spectrum: Float32Array<ArrayBuffer>;
  /** 波形 (-1..1)。 */
  waveform: Float32Array<ArrayBuffer>;
}

export interface AudioAnalysisOptions {
  level: FollowerOptions;
  /** spectrum / 帯域の平滑化。 */
  spectrum: FollowerOptions;
  /** low | mid | high の境界 (Hz)。 */
  lowMaxHz: number;
  midMaxHz: number;
  onset: Partial<OnsetOptions>;
}

const DEFAULTS: AudioAnalysisOptions = {
  level: { attack: 0.01, release: 0.2 },
  spectrum: { attack: 0, release: 0.12 },
  lowMaxHz: 200,
  midMaxHz: 2000,
  onset: {},
};

/** AnalyserNode のうち解析に使う部分だけ (テストで差し替えられるように)。 */
export interface AnalyserLike {
  readonly frequencyBinCount: number;
  readonly fftSize: number;
  readonly context: { readonly sampleRate: number };
  getFloatTimeDomainData(out: Float32Array<ArrayBuffer>): void;
  getByteFrequencyData(out: Uint8Array<ArrayBuffer>): void;
}

export interface TimeDomainStats {
  rms: number;
  peak: number;
}

export function analyseTimeDomain(buf: Float32Array): TimeDomainStats {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const s = buf[i] ?? 0;
    sum += s * s;
    const a = Math.abs(s);
    if (a > peak) peak = a;
  }
  return { rms: buf.length > 0 ? Math.sqrt(sum / buf.length) : 0, peak };
}

/** spectrum (0..1) の [loHz, hiHz) の平均。binHz = 1 ビンあたりの周波数幅。 */
export function bandAverage(
  spectrum: Float32Array,
  binHz: number,
  loHz: number,
  hiHz: number,
): number {
  if (binHz <= 0) return 0;
  const lo = Math.max(0, Math.floor(loHz / binHz));
  const hi = Math.min(spectrum.length, Math.ceil(hiHz / binHz));
  if (hi <= lo) return 0;
  let sum = 0;
  for (let i = lo; i < hi; i++) sum += spectrum[i] ?? 0;
  return sum / (hi - lo);
}

export interface AudioAnalysis {
  update(dt: number): AudioFrame;
}

export function createAudioAnalysis(
  analyser: AnalyserLike,
  options: Partial<AudioAnalysisOptions> = {},
): AudioAnalysis {
  const opts: AudioAnalysisOptions = { ...DEFAULTS, ...options };
  const bins = new Uint8Array(analyser.frequencyBinCount);
  const onset = createOnsetDetector(opts.onset);
  const lowOnset = createOnsetDetector(opts.onset);
  const frame: AudioFrame = {
    rms: 0,
    peak: 0,
    level: 0,
    low: 0,
    mid: 0,
    high: 0,
    onset: 0,
    lowOnset: 0,
    spectrum: new Float32Array(analyser.frequencyBinCount),
    waveform: new Float32Array(analyser.fftSize),
  };

  return {
    update(dt) {
      analyser.getFloatTimeDomainData(frame.waveform);
      analyser.getByteFrequencyData(bins);

      const td = analyseTimeDomain(frame.waveform);
      frame.rms = td.rms;
      frame.peak = td.peak;
      frame.level = follow(frame.level, td.rms, dt, opts.level);
      frame.onset = onset.update(td.rms, dt);

      const spectrum = frame.spectrum;
      for (let i = 0; i < spectrum.length; i++) {
        spectrum[i] = follow(spectrum[i] ?? 0, (bins[i] ?? 0) / 255, dt, opts.spectrum);
      }
      const nyquist = analyser.context.sampleRate / 2;
      const binHz = nyquist / spectrum.length;
      frame.low = bandAverage(spectrum, binHz, 0, opts.lowMaxHz);
      frame.mid = bandAverage(spectrum, binHz, opts.lowMaxHz, opts.midMaxHz);
      frame.high = bandAverage(spectrum, binHz, opts.midMaxHz, nyquist);
      frame.lowOnset = lowOnset.update(frame.low, dt);
      return frame;
    },
  };
}
