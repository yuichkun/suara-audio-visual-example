// フレームレートに依存しない平滑化の部品。時間の単位はすべて「秒」。
// (「毎フレーム 0.85 を掛ける」式の減衰は 60Hz と 120Hz で速さが変わるので使わない)

/** dt 秒で target に近づく割合。tau = 時定数 (約 63% 到達するまでの秒数)、0 以下は即時。 */
export function smoothingAlpha(dt: number, tau: number): number {
  return tau > 0 ? 1 - Math.exp(-dt / tau) : 1;
}

/** 1 次ローパス: current を target に向けて dt 秒ぶん進める。 */
export function smoothTo(current: number, target: number, dt: number, tau: number): number {
  return current + (target - current) * smoothingAlpha(dt, tau);
}

export interface FollowerOptions {
  /** 上がる時の時定数 (秒)。 */
  attack: number;
  /** 下がる時の時定数 (秒)。 */
  release: number;
}

/** envelope follower: 上がりと下がりで時定数を変える smoothTo。 */
export function follow(
  current: number,
  target: number,
  dt: number,
  opts: FollowerOptions,
): number {
  return smoothTo(current, target, dt, target > current ? opts.attack : opts.release);
}

export interface OnsetOptions {
  /** 「速い追従 - 遅い追従」がこの値を超えたら onset とみなす。 */
  threshold: number;
  /** onset 値 (1 → 0) の減衰時定数 (秒)。 */
  release: number;
}

export interface OnsetDetector {
  /** level (例: rms, 帯域エネルギー) を渡すと 0..1 の onset 値を返す。立ち上がりで 1、以後減衰。 */
  update(level: number, dt: number): number;
}

const FAST: FollowerOptions = { attack: 0, release: 0.05 };
const SLOW_TAU = 0.25;

/** 立ち上がり検出。入力の「直近」と「少し前からの平均」の差が threshold を超えた瞬間に発火する。 */
export function createOnsetDetector(opts: Partial<OnsetOptions> = {}): OnsetDetector {
  const threshold = opts.threshold ?? 0.08;
  const release = opts.release ?? 0.12;
  let fast = 0;
  let slow = 0;
  let armed = true;
  let value = 0;
  return {
    update(level, dt) {
      fast = follow(fast, level, dt, FAST);
      slow = smoothTo(slow, level, dt, SLOW_TAU);
      const rise = fast - slow;
      if (armed && rise > threshold) {
        value = 1;
        armed = false;
      } else {
        value = smoothTo(value, 0, dt, release);
        // 差が十分戻るまで再発火しない (= 持続音で連打しない)
        if (rise < threshold * 0.5) armed = true;
      }
      return value < 1e-4 ? 0 : value;
    },
  };
}
