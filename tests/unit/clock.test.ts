import { describe, it, expect } from 'vitest';
import { packClock, createWebClock, type DawClockInput } from '../../src/daw/clock';

describe('Feature: DAW clock → shader time', () => {
  it('given tempo 120, sampleRate 48000, positionSamples 48000, playing when pack then iTime === 1 and iBeat === 2', () => {
    const input: DawClockInput = {
      positionSamples: 48000,
      sampleRate: 48000,
      tempo: 120,
      timeSigNum: 4,
      isPlaying: true,
    };
    const out = packClock(input);
    expect(out.iTime).toBe(1);
    expect(out.iBeat).toBe(2);
    expect(out.iPlaying).toBe(1);
    expect(out.iTempo).toBe(120);
  });

  it('given timeSig 4/4 and 8 beats then iBar === 2', () => {
    // 8 beats at 120 BPM = 4 seconds = 192000 samples @ 48k
    const out = packClock({
      positionSamples: 192000,
      sampleRate: 48000,
      tempo: 120,
      timeSigNum: 4,
      isPlaying: true,
    });
    expect(out.iBeat).toBe(8);
    expect(out.iBar).toBe(2);
  });

  it('given web fallback, playing, dt 0.5 twice then iTime === 1 and iPlaying === 1', () => {
    const clock = createWebClock();
    clock.setPlaying(true);
    clock.tick(0.5);
    clock.tick(0.5);
    const out = clock.pack({ tempo: 120, timeSigNum: 4 });
    expect(out.iTime).toBe(1);
    expect(out.iPlaying).toBe(1);
  });

  it('given not playing then iTime holds and iPlaying === 0', () => {
    const clock = createWebClock();
    clock.setPlaying(true);
    clock.tick(1);
    clock.setPlaying(false);
    const held = clock.pack({ tempo: 120, timeSigNum: 4 }).iTime;
    clock.tick(0.5);
    const after = clock.pack({ tempo: 120, timeSigNum: 4 });
    expect(after.iTime).toBe(held);
    expect(after.iPlaying).toBe(0);
  });
});
