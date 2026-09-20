import { describe, it, expect } from 'vitest';
import { mapMidiToUniforms } from '../../src/daw/midi';

describe('Feature: MIDI notes → uniforms', () => {
  it('given notes 60 and 64 on then iNoteCount === 2 and last note/vel match', () => {
    const out = mapMidiToUniforms({
      activeNotes: new Set([60, 64]),
      lastNote: 64,
      lastVel: 0.75,
    });
    expect(out.iNoteCount).toBe(2);
    expect(out.iLastNote).toBe(64);
    expect(out.iLastVel).toBe(0.75);
  });

  it('given all off then count 0', () => {
    const out = mapMidiToUniforms({
      activeNotes: new Set(),
      lastNote: 60,
      lastVel: 1,
    });
    expect(out.iNoteCount).toBe(0);
  });
});
