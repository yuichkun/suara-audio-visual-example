import { describe, it, expect } from 'vitest';
import { useParam } from '@suara/sdk';

describe('Feature: web runtime の SDK が値を返す — useParam', () => {
  it('given useParam default 0.2 when setFromUser(0.8) then value === 0.8', () => {
    const p = useParam(0, { min: 0, max: 1, default: 0.2 });
    expect(p.value).toBe(0.2);
    p.setFromUser(0.8);
    expect(p.value).toBe(0.8);
  });
});
