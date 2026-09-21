// 「いま動くべきかどうか」のスイッチ。何が動くか (球体か、別の何かか) には関知しない。
//
// on / off をそのまま使うと動きが瞬間的に切り替わり、`iTime * on` のような使い方だと
// 止めた瞬間に位置が飛ぶ。なので 3 つの形で出す:
//   on     いま動くべきか (生の bool)
//   amount on に向かって滑らかに 0..1 で追従する値 (形や強さの補間に使う)
//   time   amount で重みづけして進む秒。止まると減速して止まり、再開すると続きから進む
//          (回転や移動など「動きの位相」に使う)

import { follow, type FollowerOptions } from './envelope';

export interface MotionFrame {
  on: boolean;
  amount: number;
  time: number;
}

export interface Motion {
  update(on: boolean, dt: number): MotionFrame;
}

const DEFAULTS: FollowerOptions = { attack: 0.5, release: 0.9 };

export function createMotion(opts: Partial<FollowerOptions> = {}): Motion {
  const ease: FollowerOptions = { ...DEFAULTS, ...opts };
  const frame: MotionFrame = { on: false, amount: 0, time: 0 };
  return {
    update(on, dt) {
      frame.on = on;
      const amount = follow(frame.amount, on ? 1 : 0, dt, ease);
      // 端で張り付かせる (いつまでも 0.9999... や 0.0001... のままにしない)
      frame.amount = amount > 0.9995 ? 1 : amount < 0.0005 ? 0 : amount;
      frame.time += dt * frame.amount;
      return frame;
    },
  };
}
