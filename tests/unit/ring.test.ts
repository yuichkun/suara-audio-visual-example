import { describe, it, expect } from 'vitest';
import {
  MIDI_RING_BYTES,
  RING_CAPACITY,
  SLOT_CAPACITY,
  drainMidi,
  writeMidiEvent,
} from '../../src/sdk/ring';

describe('Feature: MIDI ring roundtrip', () => {
  it('given write note-on when drain then pitch/vel return', () => {
    const sab = new SharedArrayBuffer(MIDI_RING_BYTES);
    const view = new Int32Array(sab);
    view[SLOT_CAPACITY] = RING_CAPACITY;

    writeMidiEvent(view, 0, 64, 800, 0);

    const got: Array<{ type: number; pitch: number; vel: number }> = [];
    drainMidi(view, 0, (type, pitch, velMilli) => {
      got.push({ type, pitch, vel: velMilli });
    });

    expect(got).toEqual([{ type: 0, pitch: 64, vel: 800 }]);
  });
});
