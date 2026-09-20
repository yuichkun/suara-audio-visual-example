// useTransport() — DAW transport を runtime 抽象で供給する。
//   VST runtime: broker が書く SuaraDawTransport.buffer (= snapshot ring) を rAF poll。
//   web runtime: helper UI の play/stop/tempo が state を駆動。
// consumer (= GUI) は handle.state を毎フレーム読むだけ (= 両 runtime 同一)。

import { runtime } from './runtime';

// transport snapshot ring layout (= broker suara_runtime_pocv2.mm と SSoT)。
// header int32: [0]=write_seq, [1]=capacity。 snapshot 8 ints:
// [state(raw VST bitmask), tempo_milli, ts_num, ts_denom, projLo, projHi, sample_rate, res]。
// reader は最新 snapshot ((write_seq-1) % capacity) を読む。
const T_HEADER_INTS = 4;
const T_SNAPSHOT_INTS = 8;
const T_CAPACITY = 8;
export const TRANSPORT_RING_BYTES = (T_HEADER_INTS + T_CAPACITY * T_SNAPSHOT_INTS) * 4;

// VST ProcessContext::StatesAndFlags (= ivstprocesscontext.h)。validity gate は
// JUCE 流に reader 側で raw state bitmask から行う。
const ST_PLAYING = 1 << 1;
const ST_RECORDING = 1 << 3;
const ST_TEMPO_VALID = 1 << 10;
const ST_TIMESIG_VALID = 1 << 13;

export interface TransportState {
  isPlaying: boolean;
  tempo: number;
  isRecording: boolean;
  /** project time in samples (VST only; web stays 0)。 */
  positionSamples: number;
  timeSigNum: number;
  timeSigDenom: number;
}

export interface TransportHandle {
  readonly state: TransportState;
  /** web runtime のみ: helper UI が transport を駆動 (= VST では DAW が供給、undefined)。 */
  setPlaying?: (playing: boolean) => void;
  setTempo?: (bpm: number) => void;
}

let handle: TransportHandle | null = null;

export function useTransport(): TransportHandle {
  if (handle) return handle;

  const state: TransportState = {
    isPlaying: false,
    tempo: 120,
    isRecording: false,
    positionSamples: 0,
    timeSigNum: 4,
    timeSigDenom: 4,
  };
  handle = { state };

  if (runtime.isVst) {
    startVstDrain(state);
  } else {
    handle.setPlaying = (playing) => {
      state.isPlaying = playing;
    };
    handle.setTempo = (bpm) => {
      state.tempo = bpm;
    };
  }
  return handle;
}

// ~10s @60fps を取得再試行の上限に (= midi.ts と同方針、 boot race self-heal)。
const MAX_ACQUIRE_FRAMES = 600;

function startVstDrain(state: TransportState): void {
  let frames = 0;
  const start = (): void => {
    let view: Int32Array;
    try {
      const sab = new SuaraDawTransport().buffer as unknown as SharedArrayBuffer;
      view = new Int32Array(sab);
    } catch {
      // broker transport stream not ready yet (= async 注入の boot race)。
      // 諦めず次フレームで再試行 (= 注入が届いたら自動で transport が動き出す)。
      if (++frames <= MAX_ACQUIRE_FRAMES) requestAnimationFrame(start);
      return;
    }
    startPoll(state, view);
  };
  start();
}

function startPoll(state: TransportState, view: Int32Array): void {
  const poll = (): void => {
    const seq = Atomics.load(view, 0);
    if (seq > 0) {
      const cap = view[1] || T_CAPACITY;
      const ring = (seq - 1) % cap;
      const base = T_HEADER_INTS + ring * T_SNAPSHOT_INTS;
      const st = view[base + 0] ?? 0;
      state.isPlaying = (st & ST_PLAYING) !== 0;
      state.isRecording = (st & ST_RECORDING) !== 0;
      if (st & ST_TEMPO_VALID) {
        state.tempo = (view[base + 1] ?? 0) / 1000;
      }
      if (st & ST_TIMESIG_VALID) {
        state.timeSigNum = view[base + 2] ?? 4;
        state.timeSigDenom = view[base + 3] ?? 4;
      }
      // int64 projectTimeSamples = hi * 2^32 + lo (lo as unsigned 32-bit).
      const lo = (view[base + 4] ?? 0) >>> 0;
      const hi = view[base + 5] ?? 0;
      state.positionSamples = hi * 4294967296 + lo;
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}
