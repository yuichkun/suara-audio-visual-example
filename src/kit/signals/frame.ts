// 全 signal を 1 フレームぶんまとめた Frame を作る。renderer (GLSL / three.js / p5 ...) には
// 依存しない。毎フレーム update() を呼んで、返ってきた Frame を好きな描画に渡す。

import type { MidiHandle, TransportHandle } from '@suara/sdk';
import type { AudioGraph } from '../audio-graph';
import { createAudioAnalysis, type AudioAnalysisOptions, type AudioFrame } from './audio';
import type { FollowerOptions } from './envelope';
import { createMidiSignal, type MidiFrame } from './midi';
import { createMotion, type MotionFrame } from './motion';
import { readParams, type BoundParam } from './params';
import { createBeatTracker, createPlayhead, type Playhead, type TransportFrame } from './transport';

export interface Frame<P extends string = string> {
  /** ページを開いてからの秒。transport に関係なく常に進む (Shadertoy の iTime と同じ)。 */
  time: number;
  /** 前フレームからの秒。 */
  dt: number;
  /** フレーム番号。 */
  index: number;
  transport: TransportFrame;
  /** main bus (= plugin を挿したトラックの音)。 */
  audio: AudioFrame;
  /** sidechain bus。 */
  sidechain: AudioFrame;
  midi: MidiFrame;
  /** 「いま動くべきか」のスイッチ。default では transport が再生中かどうか。 */
  motion: MotionFrame;
  /** automation param の現在値 (denormalized)。 */
  params: Record<P, number>;
}

export interface SignalsOptions<P extends string> {
  transport: TransportHandle;
  midi: MidiHandle;
  graph: AudioGraph;
  params: Record<P, BoundParam>;
  audio?: Partial<AudioAnalysisOptions>;
  sidechain?: Partial<AudioAnalysisOptions>;
  midiEnvelope?: Partial<FollowerOptions>;
  /** motion の on 条件。default は transport が再生中。 */
  isMoving?: (frame: Frame<P>) => boolean;
  /** motion.amount が立ち上がる / 下がる時定数 (秒)。 */
  motionEase?: Partial<FollowerOptions>;
}

export interface Signals<P extends string> {
  /** rAF の timestamp (ms) を渡す。返る Frame は毎回同じ object を使い回す。 */
  update(nowMs: number): Frame<P>;
  readonly playhead: Playhead;
}

// タブが裏に回った後などの巨大な dt で envelope が飛ばないようにする上限 (秒)
const MAX_DT = 0.1;

export function createSignals<P extends string>(opts: SignalsOptions<P>): Signals<P> {
  const playhead = createPlayhead(opts.transport, () => opts.graph.ctx.sampleRate);
  const tracker = createBeatTracker();
  const audio = createAudioAnalysis(opts.graph.main, opts.audio);
  const sidechain = createAudioAnalysis(opts.graph.sidechain, opts.sidechain);
  const midi = createMidiSignal(opts.midi, opts.midiEnvelope);
  const motion = createMotion(opts.motionEase);
  const isMoving = opts.isMoving ?? ((f: Frame<P>) => f.transport.playing);

  let lastMs: number | null = null;
  const frame: Frame<P> = {
    time: 0,
    dt: 0,
    index: 0,
    transport: tracker.update(playhead.read(0), 0),
    audio: audio.update(0),
    sidechain: sidechain.update(0),
    midi: midi.update(0),
    motion: motion.update(false, 0),
    params: readParams(opts.params),
  };

  return {
    playhead,
    update(nowMs) {
      const dt = lastMs === null ? 0 : Math.min(MAX_DT, Math.max(0, (nowMs - lastMs) / 1000));
      lastMs = nowMs;
      frame.dt = dt;
      frame.time += dt;
      frame.index++;
      frame.transport = tracker.update(playhead.read(dt), dt);
      frame.audio = audio.update(dt);
      frame.sidechain = sidechain.update(dt);
      frame.midi = midi.update(dt);
      readParams(opts.params, frame.params);
      frame.motion = motion.update(isMoving(frame), dt);
      return frame;
    },
  };
}
