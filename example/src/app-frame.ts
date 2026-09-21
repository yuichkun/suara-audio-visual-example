// kit の Frame に、この作品固有の値を足す。main.ts が毎フレーム extend() を呼び、
// uniforms.ts がここの値を shader に渡す。
import {
  createBlendWeights,
  createOnsetDetector,
  follow,
  pulse,
  smoothTo,
  type Frame,
} from './kit/signals';
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
  /** ホール (壁とドーム) の回転角 (rad)。低音と Energy で進む。 */
  hallAngle: number;
  /** クライマックスのノブ 0..1 (Energy param を少し均したもの)。 */
  energy: number;
  // Energy で速さが変わるものの「位相」。速さを掛け算で変えると位置が飛ぶので、TS 側で積算して渡す
  /** 本体の回転・輪の回転・パッドの目盛り。 */
  driveTime: number;
  /** 本体のまわりの群れ (衛星と破片)。 */
  swarmTime: number;
  /** カメラが本体のまわりを回り込む角度 (rad)。 */
  orbitAngle: number;
};

// 「まだ一度も鳴っていない」時の bassHitAge。exp(-age) が 0 になる程度に大きい値
const NEVER = 1e4;
// hallAngle を折り返す周期。ドームは -0.6 倍で逆回転するので、どちらも途切れない 5 周ぶんで折り返す
const HALL_WRAP = Math.PI * 2 * 5;
const TAU = Math.PI * 2;

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
  let energy = 0;
  let driveTime = 0;
  let swarmTime = 0;
  let orbitAngle = 0;

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
      // Energy: ノブの段差を均し、2 乗して「低いうちは穏やか、上のほうで一気に」にする
      energy = smoothTo(energy, clamp01(frame.params.energy), frame.dt, tune.energy.smooth);
      const e2 = energy * energy;
      // 動いている間だけ進む時間 (止めると全部が減速して止まる)
      const step = frame.dt * frame.motion.amount;
      driveTime += step * (1 + tune.energy.spinBoost * e2);
      swarmTime += step * (1 + tune.energy.swarmBoost * e2);
      orbitAngle = (orbitAngle + step * tune.energy.orbitSpeed * e2) % TAU;
      // ホールを回す力 = 低音の強さ + Energy。低音が止んで Energy も 0 なら減速して止まる
      hallAngle = (hallAngle + step * (bass * tune.bass.hallSpin + e2 * tune.energy.hallSpin)) % HALL_WRAP;
      frame.energy = energy;
      frame.driveTime = driveTime;
      frame.swarmTime = swarmTime;
      frame.orbitAngle = orbitAngle;
      frame.hallAngle = hallAngle;
      frame.bass = bass;
      frame.bassHitAge = bassHitAge;
      frame.bassHit = bassHit;
      return frame;
    },
  };
}
