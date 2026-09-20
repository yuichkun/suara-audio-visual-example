import { useParam } from '@suara/sdk';
import { SCENES } from '../scenes';

/** suara.json ids — keep in sync. Scene max = last scene index. */
export function createParams() {
  return {
    scene: useParam(0, { min: 0, max: SCENES.length - 1, default: 0 }),
    intensity: useParam(1, { min: 0, max: 1, default: 0.5 }),
    hue: useParam(2, { min: 0, max: 1, default: 0.5 }),
    speed: useParam(3, { min: 0, max: 1, default: 0.5 }),
    audioAmount: useParam(4, { min: 0, max: 1, default: 1 }),
  };
}

export type Params = ReturnType<typeof createParams>;
