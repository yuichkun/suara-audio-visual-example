import type { UniformState } from './layout';

/**
 * Workshop extension point: mutate or return a derived UniformState each frame.
 * e.g. ease macros, compute custom envelopes, remap Scene.
 */
export function derive(state: UniformState): UniformState {
  return state;
}
