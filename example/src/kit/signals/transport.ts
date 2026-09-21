// transport → 音楽的な時間 (beat / bar / phase)。
//
// SDK が出すのは「再生位置 (samples) と現在のテンポ」だけで、DAW の PPQ 位置は出ない。
// なので beat は自前で積む:
//   - 連続再生中は テンポ × 経過時間 を積分 (= 曲中のテンポ変化に追従する)
//   - locate / loop で位置が飛んだら「曲頭からずっと今のテンポだった」と仮定して付け直す
// ⚠️ 制約: テンポチェンジがある曲を途中から再生すると beat の絶対値 (と位相) は DAW と
//   ズレる。拍子チェンジも同様 (bar は拍子一定と仮定)。SDK に PPQ が来たら差し替える。

import { runtime, type TransportHandle } from '@suara/sdk';

/** 1 フレームぶんの再生位置の生データ。 */
export interface PlayheadSample {
  /** 曲頭からの再生位置 (秒)。 */
  seconds: number;
  playing: boolean;
  tempo: number;
  timeSigNum: number;
  timeSigDenom: number;
}

export interface TransportFrame {
  /** 曲頭からの再生位置 (秒)。停止中は止まる。 */
  songTime: number;
  /** 曲頭からの拍数 (4 分音符単位、小数)。 */
  beat: number;
  /** 曲頭からの小節数 (小数)。 */
  bar: number;
  /** 拍の中の位置 0..1。 */
  beatPhase: number;
  /** 小節の中の位置 0..1。 */
  barPhase: number;
  tempo: number;
  playing: boolean;
  /** このフレームで再生位置が飛んだ (locate / loop)。 */
  jumped: boolean;
  timeSigNum: number;
  timeSigDenom: number;
}

function fract(x: number): number {
  return x - Math.floor(x);
}

/** 1 小節の長さ (4 分音符単位)。6/8 なら 3。 */
export function beatsPerBar(timeSigNum: number, timeSigDenom: number): number {
  const num = Math.max(1, timeSigNum);
  const denom = Math.max(1, timeSigDenom);
  return (num * 4) / denom;
}

/** beat を cycleBeats 拍周期で 0..1 に畳む。phase(beat, 4) = 4 拍で 1 周、phase(beat, 0.5) = 8 分。 */
export function phase(beat: number, cycleBeats: number): number {
  return cycleBeats > 0 ? fract(beat / cycleBeats) : 0;
}

/** 周期の頭で 1、そこから指数減衰するパルス。sharpness が大きいほど短い。 */
export function pulse(beat: number, cycleBeats: number, sharpness = 6): number {
  return Math.exp(-sharpness * phase(beat, cycleBeats));
}

// 再生中にこれ以上位置が進んだら「飛んだ」とみなす (秒)。rAF が詰まった時の誤検出を避ける下限。
const JUMP_MIN_SECONDS = 0.5;

export interface BeatTracker {
  update(sample: PlayheadSample, dt: number): TransportFrame;
}

/** PlayheadSample の列から TransportFrame を作る (SDK 非依存の純ロジック)。 */
export function createBeatTracker(): BeatTracker {
  // beat = anchorBeat + (seconds - anchorSeconds) * anchorTempo / 60
  let anchorSeconds = 0;
  let anchorBeat = 0;
  let anchorTempo = 0;
  let prevSeconds = 0;
  let started = false;

  const beatAt = (seconds: number): number =>
    anchorBeat + ((seconds - anchorSeconds) * anchorTempo) / 60;

  return {
    update(sample, dt) {
      const { seconds, tempo } = sample;
      const delta = seconds - prevSeconds;
      const jumped = started && (delta < 0 || delta > Math.max(JUMP_MIN_SECONDS, dt * 4));

      if (!started || jumped) {
        anchorSeconds = seconds;
        anchorBeat = (seconds * tempo) / 60;
        anchorTempo = tempo;
        started = true;
      } else if (tempo !== anchorTempo) {
        // テンポが変わった: ここまでの beat を確定させて、以後は新テンポで進める
        anchorBeat = beatAt(seconds);
        anchorSeconds = seconds;
        anchorTempo = tempo;
      }
      prevSeconds = seconds;

      const beat = beatAt(seconds);
      const barLen = beatsPerBar(sample.timeSigNum, sample.timeSigDenom);
      return {
        songTime: seconds,
        beat,
        bar: beat / barLen,
        beatPhase: fract(beat),
        barPhase: fract(beat / barLen),
        tempo,
        playing: sample.playing,
        jumped,
        timeSigNum: sample.timeSigNum,
        timeSigDenom: sample.timeSigDenom,
      };
    },
  };
}

export interface StepTrigger {
  /** stepBeats 拍ごとの境界を跨いだフレームで true。 */
  update(frame: Pick<TransportFrame, 'beat' | 'playing'>): boolean;
}

/** 「1 拍ごと」「1 小節 (4 拍) ごと」のように JS 側で何かを起こしたい時のトリガ。 */
export function createStepTrigger(stepBeats: number): StepTrigger {
  let prevIndex: number | null = null;
  return {
    update(frame) {
      const index = Math.floor(frame.beat / stepBeats);
      const fired = frame.playing && prevIndex !== null && index !== prevIndex;
      prevIndex = index;
      return fired;
    },
  };
}

export interface Playhead {
  read(dt: number): PlayheadSample;
  /** web runtime のみ: 合成再生位置を動かす (VST では DAW が位置を持つので undefined)。 */
  seek?: (seconds: number) => void;
}

/**
 * useTransport() を PlayheadSample に変換する。
 *   VST: DAW の positionSamples を秒に直す。
 *   web: positionSamples は更新されないので、再生中だけ進む合成位置を持つ。
 */
export function createPlayhead(transport: TransportHandle, sampleRate: () => number): Playhead {
  let webSeconds = 0;
  const playhead: Playhead = {
    read(dt) {
      const st = transport.state;
      let seconds: number;
      if (runtime.isVst) {
        const sr = sampleRate();
        seconds = sr > 0 ? st.positionSamples / sr : 0;
      } else {
        if (st.isPlaying) webSeconds += dt;
        seconds = webSeconds;
      }
      return {
        seconds,
        playing: st.isPlaying,
        tempo: st.tempo,
        timeSigNum: st.timeSigNum,
        timeSigDenom: st.timeSigDenom,
      };
    },
  };
  if (runtime.isWeb) {
    playhead.seek = (seconds) => {
      webSeconds = Math.max(0, seconds);
    };
  }
  return playhead;
}
