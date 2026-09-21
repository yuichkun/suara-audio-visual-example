import { describe, it, expect } from 'vitest';
import type { MidiNoteEvent } from '@suara/sdk';
import { createMidiSignal } from '../../cli/templates/glsl/src/kit/signals/midi';

function fakeMidi() {
  const activeNotes = new Set<number>();
  const listeners = new Set<(e: MidiNoteEvent) => void>();
  return {
    activeNotes,
    on: (_: 'noteon' | 'noteoff', cb: (e: MidiNoteEvent) => void) => void listeners.add(cb),
    off: (_: 'noteon' | 'noteoff', cb: (e: MidiNoteEvent) => void) => void listeners.delete(cb),
    noteOn(note: number, velocity: number) {
      activeNotes.add(note);
      for (const cb of listeners) cb({ note, velocity, sampleOffset: 0 });
    },
    noteOff(note: number) {
      activeNotes.delete(note);
    },
    listenerCount: () => listeners.size,
  };
}

const DT = 1 / 60;

describe('Feature: MIDI note → envelope', () => {
  it('given note 60 を velocity 0.8 で押す then envelope が velocity まで立ち上がる', () => {
    const midi = fakeMidi();
    const sig = createMidiSignal(midi);
    midi.noteOn(60, 0.8);
    let f = sig.update(DT);
    for (let i = 0; i < 10; i++) f = sig.update(DT);
    expect(f.envelopes[60]).toBeCloseTo(0.8, 2);
    expect(f.level).toBeCloseTo(0.8, 2);
    expect(f.pitchClasses[0]).toBeCloseTo(0.8, 2);
    expect(f.heldCount).toBe(1);
    expect(f.lastNote).toBe(60);
    expect(f.lastVelocity).toBe(0.8);
    expect(f.noteOnCount).toBe(1);
  });

  it('given 離す then release で減衰して 0 になる', () => {
    const midi = fakeMidi();
    const sig = createMidiSignal(midi, { release: 0.1 });
    midi.noteOn(64, 1);
    for (let i = 0; i < 10; i++) sig.update(DT);
    midi.noteOff(64);
    const soon = sig.update(DT).envelopes[64] ?? 0;
    expect(soon).toBeGreaterThan(0.5);
    let f = sig.update(DT);
    for (let i = 0; i < 120; i++) f = sig.update(DT);
    expect(f.envelopes[64]).toBe(0);
    expect(f.heldCount).toBe(0);
  });

  it('given 1 フレーム内で on → off された note then それでも envelope が蹴られる', () => {
    const midi = fakeMidi();
    const sig = createMidiSignal(midi, { attack: 0 });
    midi.noteOn(72, 1);
    midi.noteOff(72);
    expect(sig.update(DT).envelopes[72]).toBe(1);
  });

  it('noteAge は note-on で 0 に戻って秒で進む', () => {
    const midi = fakeMidi();
    const sig = createMidiSignal(midi);
    expect(sig.update(DT).noteAge).toBeGreaterThan(1000);
    midi.noteOn(60, 1);
    sig.update(0.5);
    expect(sig.update(0.5).noteAge).toBeCloseTo(1, 6);
  });

  it('dispose で listener を外す', () => {
    const midi = fakeMidi();
    const sig = createMidiSignal(midi);
    expect(midi.listenerCount()).toBe(1);
    sig.dispose();
    expect(midi.listenerCount()).toBe(0);
  });
});
