// kit の Frame に、この作品固有の値を足す。main.ts が毎フレーム extend() を呼び、
// uniforms.ts がここの値を shader に渡す。
import { createBlendWeights, createOnsetDetector, follow, pulse, type Frame } from './kit/signals';
import type { ParamKey } from './params';
// type だけを import する (値を import すると tuning.ts の hot reload が full reload になる)
import type { tuning } from './tuning';

export type Tuning = typeof tuning;

export type AppFrame = Frame<ParamKey> & {
  /** 4 つ打ちの脈打ち 0..1 (tuning.pulse)。 */
  pulse: number;
  /** 再生中の形それぞれの重み [割れた球, 結晶, 輪]。合計 1 (tuning.shape)。 */
  shapeWeights: Float32Array;
  /** sidechain の低音の強さ 0..1 (tuning.bass)。 */
  bass: number;
  /** sidechain の低音が最後に立ち上がってからの秒数と、その時の強さ 0..1。 */
  bassHitAge: number;
  bassHit: number;
  /** ホール (壁とドーム) の回転角 (rad)。低音が鳴っている間だけ進む。 */
  hallAngle: number;
};

// 「まだ一度も鳴っていない」時の bassHitAge。exp(-age) が 0 になる程度に大きい値
const NEVER = 1e4;
// hallAngle を折り返す周期。ドームは -0.6 倍で逆回転するので、どちらも途切れない 5 周ぶんで折り返す
const HALL_WRAP = Math.PI * 2 * 5;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export interface AppFrameSource {
  /** kit の Frame をその場で AppFrame に拡張して返す。tune は hot reload された最新の tuning。 */
  extend(frame: Frame<ParamKey>, tune: Tuning): AppFrame;
}

export function createAppFrame(initial: Tuning): AppFrameSource {
  const shapeBlend = createBlendWeights(3, initial.shape.morphSeconds);
  const bassOnset = createOnsetDetector();
  let bass = 0;
  let bassHitAge = NEVER;
  let bassHit = 0;
  let hallAngle = 0;

  return {
    extend(base, tune) {
      const frame = base as AppFrame;
      const { beat, playing } = frame.transport;
      frame.pulse = playing ? pulse(beat, tune.pulse.cycleBeats, tune.pulse.sharpness) : 0;
      frame.shapeWeights = shapeBlend.update(frame.params.shape, frame.dt);

      // sidechain の低域 (0..1、dB スケール) を floor〜ceil で切り出して 0..1 にする
      const { floor, ceil, attack, release } = tune.bass;
      const raw = clamp01((frame.sidechain.low - floor) / Math.max(1e-6, ceil - floor));
      bass = follow(bass, raw, frame.dt, { attack, release });
      if (bassOnset.update(raw, frame.dt) >= 1) {
        bassHitAge = 0;
        bassHit = raw;
      } else {
        bassHitAge = Math.min(NEVER, bassHitAge + frame.dt);
      }
      // 低音の強さ = ホールを回す力。動いている間だけ効き、低音が止むと減速して止まる
      hallAngle = (hallAngle + bass * frame.motion.amount * tune.bass.hallSpin * frame.dt) % HALL_WRAP;
      frame.hallAngle = hallAngle;
      frame.bass = bass;
      frame.bassHitAge = bassHitAge;
      frame.bassHit = bassHit;
      return frame;
    },
  };
}
