import { describe, it, expect } from 'vitest';
import { useTransport } from '@suara/sdk';

describe('Feature: web runtime の SDK が値を返す — useTransport', () => {
  it('given useTransport when setPlaying(true) and setTempo(140) then state updates', () => {
    const t = useTransport();
    expect(t.setPlaying).toBeTypeOf('function');
    expect(t.setTempo).toBeTypeOf('function');
    t.setPlaying!(true);
    t.setTempo!(140);
    expect(t.state.isPlaying).toBe(true);
    expect(t.state.tempo).toBe(140);
  });
});
