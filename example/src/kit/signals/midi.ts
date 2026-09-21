// MIDI note → 絵に使いやすい値。note ごとの envelope (押すと立ち上がり、離すと減衰) を持つ。
// SDK の MIDI は note on/off + velocity のみ (CC / pitch bend は来ない)。

import type { MidiHandle, MidiNoteEvent } from '@suara/sdk';
import { follow, type FollowerOptions } from './envelope';

export const NOTE_COUNT = 128;

// 「まだ一度も note-on が来ていない」時の noteAge。exp(-noteAge) が 0 になる程度に大きい値。
const NEVER = 1e4;

export interface MidiFrame {
  /** いま押されている note の数。 */
  heldCount: number;
  /** 最後に note-on された note 番号 (0..127)。 */
  lastNote: number;
  /** 最後の note-on の velocity (0..1)。 */
  lastVelocity: number;
  /** 最後の note-on からの経過秒。 */
  noteAge: number;
  /** note-on の通算回数。値が変わった = 新しい note が来た、の検出に使う。 */
  noteOnCount: number;
  /** envelopes の最大値 (= MIDI 全体の「鳴っている度」)。 */
  level: number;
  /** note ごとの envelope (長さ 128、0..1、velocity でスケール)。 */
  envelopes: Float32Array<ArrayBuffer>;
  /** ピッチクラス (C, C#, ... B) ごとの envelope 最大値 (長さ 12)。 */
  pitchClasses: Float32Array<ArrayBuffer>;
}

export interface MidiSignal {
  update(dt: number): MidiFrame;
  dispose(): void;
}

const DEFAULT_ENVELOPE: FollowerOptions = { attack: 0.005, release: 0.25 };

export function createMidiSignal(
  midi: Pick<MidiHandle, 'on' | 'off' | 'activeNotes'>,
  opts: Partial<FollowerOptions> = {},
): MidiSignal {
  const envelope: FollowerOptions = { ...DEFAULT_ENVELOPE, ...opts };
  const velocities = new Float32Array(NOTE_COUNT);
  // 1 フレーム内で on → off された短い note も envelope を蹴れるようにするフラグ
  const struck = new Uint8Array(NOTE_COUNT);

  const frame: MidiFrame = {
    heldCount: 0,
    lastNote: 0,
    lastVelocity: 0,
    noteAge: NEVER,
    noteOnCount: 0,
    level: 0,
    envelopes: new Float32Array(NOTE_COUNT),
    pitchClasses: new Float32Array(12),
  };

  const onNoteOn = (e: MidiNoteEvent): void => {
    if (e.note < 0 || e.note >= NOTE_COUNT) return;
    velocities[e.note] = e.velocity;
    struck[e.note] = 1;
    frame.lastNote = e.note;
    frame.lastVelocity = e.velocity;
    frame.noteAge = 0;
    frame.noteOnCount++;
  };
  midi.on('noteon', onNoteOn);

  return {
    update(dt) {
      const env = frame.envelopes;
      const pcs = frame.pitchClasses;
      pcs.fill(0);
      let level = 0;
      for (let n = 0; n < NOTE_COUNT; n++) {
        const on = midi.activeNotes.has(n) || struck[n] === 1;
        const target = on ? (velocities[n] ?? 0) : 0;
        const v = follow(env[n] ?? 0, target, dt, envelope);
        env[n] = v < 1e-4 ? 0 : v;
        struck[n] = 0;
        if (v > level) level = v;
        const pc = n % 12;
        if (v > (pcs[pc] ?? 0)) pcs[pc] = v;
      }
      frame.level = level;
      frame.heldCount = midi.activeNotes.size;
      frame.noteAge = Math.min(NEVER, frame.noteAge + dt);
      return frame;
    },
    dispose() {
      midi.off('noteon', onNoteOn);
    },
  };
}
