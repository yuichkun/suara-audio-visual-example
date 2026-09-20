import type { ClockUniforms } from '../daw/clock';
import type { MidiUniforms } from '../daw/midi';

/** Shadertoy-style uniforms shared by GLSL scenes and CLI --bind. */
export interface UniformState extends ClockUniforms, MidiUniforms {
  iResolutionX: number;
  iResolutionY: number;
  iDelta: number;
  iRms: number;
  iPeak: number;
  iHit: number;
  iScene: number;
  iP0: number; // Intensity
  iP1: number; // Hue
  iP2: number; // Speed
  iP3: number; // AudioAmount
}

export function createUniformState(): UniformState {
  return {
    iResolutionX: 1,
    iResolutionY: 1,
    iTime: 0,
    iDelta: 0,
    iBeat: 0,
    iBar: 0,
    iTempo: 120,
    iPlaying: 0,
    iRms: 0,
    iPeak: 0,
    iHit: 0,
    iNoteCount: 0,
    iLastNote: 0,
    iLastVel: 0,
    iScene: 0,
    iP0: 0.5,
    iP1: 0.5,
    iP2: 0.5,
    iP3: 1,
  };
}
