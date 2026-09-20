import { describe, it, expect } from 'vitest';
import { useMidi } from '@suara/sdk';

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

describe('Feature: web runtime の SDK が値を返す — useMidi', () => {
  it('given useMidi when whenReady then SAB returns; pushNote updates activeNotes and fires noteon', async () => {
    const midi = useMidi();
    const sab = await midi.whenReady();
    expect(sab).toBeInstanceOf(SharedArrayBuffer);

    const events: number[] = [];
    midi.on('noteon', (e) => events.push(e.note));

    expect(midi.pushNote).toBeTypeOf('function');
    midi.pushNote!(0, 60, 1);

    // poll drains the ring on rAF
    await nextFrame();
    await nextFrame();

    expect(midi.activeNotes.has(60)).toBe(true);
    expect(events).toContain(60);
  });
});
