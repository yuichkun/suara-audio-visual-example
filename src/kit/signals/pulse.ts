// 拍に同期したパルス。ただし「実際にビートが鳴っている間だけ」出る。
//
//   形  : transport の拍グリッドから作る (周期の頭で 1、そこから減衰)。音の検出は数十 ms
//         遅れるが、グリッドは DAW と同じ時刻なので、パルスは拍にぴったり乗る
//   門  : onset (キックなど) が届いている間だけ開く。最後の onset から holdBeats 拍は開いたまま、
//         そこから fadeBeats 拍かけて閉じる。= ビートの無いパートでは勝手に脈打たない

import { phase, type TransportFrame } from './transport';

export interface GatedPulseOptions {
  /** パルスの周期 (拍)。1 = 4 分音符ごと。 */
  cycleBeats: number;
  /** 減衰の鋭さ。大きいほど短く鋭い。 */
  sharpness: number;
  /** 最後の onset からこの拍数は門を開けたままにする。 */
  holdBeats: number;
  /** 門が閉じるのにかける拍数。 */
  fadeBeats: number;
}

export interface GatedPulseFrame {
  /** 0..1。 */
  pulse: number;
  /** 門の開き具合 0..1。 */
  presence: number;
}

export interface GatedPulse {
  /** onset: 門を開ける信号 (AudioFrame の onset / lowOnset)。null なら門は常に開く。 */
  update(
    transport: Pick<TransportFrame, 'beat' | 'tempo' | 'playing'>,
    onset: number | null,
    dt: number,
  ): GatedPulseFrame;
}

const DEFAULTS: GatedPulseOptions = { cycleBeats: 1, sharpness: 5, holdBeats: 1.5, fadeBeats: 1 };

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createGatedPulse(options: Partial<GatedPulseOptions> = {}): GatedPulse {
  const opts: GatedPulseOptions = { ...DEFAULTS, ...options };
  let beatsSinceOnset = Number.POSITIVE_INFINITY;
  let prevOnset = 0;
  const frame: GatedPulseFrame = { pulse: 0, presence: 0 };

  return {
    update(transport, onset, dt) {
      if (onset === null) {
        frame.presence = 1;
      } else {
        // onset は発火の瞬間だけ跳ね上がり、あとは減衰するだけ → 増えた = 新しい発火
        if (onset > prevOnset + 1e-3) beatsSinceOnset = 0;
        else beatsSinceOnset += (dt * transport.tempo) / 60;
        prevOnset = onset;
        frame.presence =
          1 - smoothstep(opts.holdBeats, opts.holdBeats + Math.max(1e-6, opts.fadeBeats), beatsSinceOnset);
      }
      frame.pulse = transport.playing
        ? Math.exp(-opts.sharpness * phase(transport.beat, opts.cycleBeats)) * frame.presence
        : 0;
      return frame;
    },
  };
}
