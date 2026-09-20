// DAW → 絵に使いやすい値、の部品集。renderer 非依存。
// まとめて使うなら createSignals()、個別に使うなら各 create* / 純関数を直接 import する。

export { createSignals } from './frame';
export type { Frame, Signals, SignalsOptions } from './frame';

export { beatsPerBar, createBeatTracker, createPlayhead, createStepTrigger, phase, pulse } from './transport';
export type { BeatTracker, Playhead, PlayheadSample, StepTrigger, TransportFrame } from './transport';

export { NOTE_COUNT, createMidiSignal } from './midi';
export type { MidiFrame, MidiSignal } from './midi';

export { analyseTimeDomain, bandAverage, createAudioAnalysis } from './audio';
export type { AnalyserLike, AudioAnalysis, AudioAnalysisOptions, AudioFrame } from './audio';

export { defineParams, readParams } from './params';
export type { BoundParam, ManifestParam, ParamSpec } from './params';

export { createOnsetDetector, follow, smoothTo, smoothingAlpha } from './envelope';
export type { FollowerOptions, OnsetDetector, OnsetOptions } from './envelope';
