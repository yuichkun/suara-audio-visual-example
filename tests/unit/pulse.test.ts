import { describe, it, expect } from 'vitest';
import { createGatedPulse } from '../../src/kit/signals/pulse';

const DT = 1 / 60;
const TEMPO = 120; // 1 拍 = 0.5 秒 = 30 フレーム

/** beat を進めながら回す。kickEvery (拍) ごとに onset を 1 にし、それ以外は減衰させる。 */
function run(
  pulse: ReturnType<typeof createGatedPulse>,
  fromBeat: number,
  beats: number,
  kickEvery: number | null,
  playing = true,
) {
  let onset = 0;
  let last = { pulse: 0, presence: 0 };
  const frames = Math.round((beats * 60) / TEMPO / DT);
  for (let i = 0; i <= frames; i++) {
    const beat = fromBeat + (i * DT * TEMPO) / 60;
    const onKick = kickEvery !== null && Math.abs(beat / kickEvery - Math.round(beat / kickEvery)) < 1e-6;
    onset = onKick ? 1 : onset * 0.8;
    last = { ...pulse.update({ beat, tempo: TEMPO, playing }, onset, DT) };
  }
  return last;
}

describe('Feature: ビートが鳴っている間だけ出る、拍同期のパルス', () => {
  it('given 再生中でも onset が来ない then 脈打たない', () => {
    expect(run(createGatedPulse(), 0, 8, null)).toEqual({ pulse: 0, presence: 0 });
  });

  it('given 4 つ打ち then 門が開いて、拍の頭で 1・拍の中で減衰する', () => {
    const p = createGatedPulse({ sharpness: 5 });
    const onBeat = run(p, 0, 4, 1);
    expect(onBeat.presence).toBe(1);
    expect(onBeat.pulse).toBeCloseTo(1, 6);
    const halfway = run(p, 4, 0.5, 1);
    expect(halfway.pulse).toBeCloseTo(Math.exp(-2.5), 2);
  });

  it('given キックが止む then hold の間は続き、その後 fade して消える', () => {
    const p = createGatedPulse({ holdBeats: 1.5, fadeBeats: 1 });
    run(p, 0, 4, 1);
    expect(run(p, 4, 1, null).presence).toBe(1);
    const fading = run(p, 5, 1, null).presence;
    expect(fading).toBeGreaterThan(0);
    expect(fading).toBeLessThan(1);
    expect(run(p, 6, 2, null)).toEqual({ pulse: 0, presence: 0 });
  });

  it('given 停止中 then キックが来ていても脈打たない', () => {
    expect(run(createGatedPulse(), 0, 4, 1, false).pulse).toBe(0);
  });

  it('given onset に null を渡す then 門は常に開く (グリッドだけで脈打つ)', () => {
    const p = createGatedPulse();
    const f = p.update({ beat: 8, tempo: TEMPO, playing: true }, null, DT);
    expect(f).toEqual({ pulse: 1, presence: 1 });
  });
});
