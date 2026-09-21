// Frame → GLSL uniform の標準セット。shader から使える名前はここが一覧。
// (iResolution は renderer の built-in。自前の uniform は project 側の uniforms.ts に足す)

import type { BoundParam, Frame } from '../signals';
import type { UniformSpec } from './renderer';

export const standardUniforms: readonly UniformSpec<Frame>[] = [
  // --- 時間 (Shadertoy 互換の名前。transport に関係なく常に進む) ---
  { name: 'iTime', type: 'float', get: (f) => f.time },
  { name: 'iTimeDelta', type: 'float', get: (f) => f.dt },
  { name: 'iFrame', type: 'float', get: (f) => f.index },

  // --- transport (DAW の再生位置に追従。停止中は止まる) ---
  { name: 'iSongTime', type: 'float', get: (f) => f.transport.songTime },
  { name: 'iBeat', type: 'float', get: (f) => f.transport.beat },
  { name: 'iBar', type: 'float', get: (f) => f.transport.bar },
  { name: 'iBeatPhase', type: 'float', get: (f) => f.transport.beatPhase },
  { name: 'iBarPhase', type: 'float', get: (f) => f.transport.barPhase },
  { name: 'iTempo', type: 'float', get: (f) => f.transport.tempo },
  { name: 'iPlaying', type: 'float', get: (f) => (f.transport.playing ? 1 : 0) },

  // --- motion (「いま動くべきか」。default は transport が再生中) ---
  { name: 'iMotion', type: 'float', get: (f) => f.motion.amount },
  { name: 'iMotionTime', type: 'float', get: (f) => f.motion.time },

  // --- audio: main bus ---
  { name: 'iLevel', type: 'float', get: (f) => f.audio.level },
  { name: 'iRms', type: 'float', get: (f) => f.audio.rms },
  { name: 'iPeak', type: 'float', get: (f) => f.audio.peak },
  { name: 'iLow', type: 'float', get: (f) => f.audio.low },
  { name: 'iMid', type: 'float', get: (f) => f.audio.mid },
  { name: 'iHigh', type: 'float', get: (f) => f.audio.high },
  { name: 'iOnset', type: 'float', get: (f) => f.audio.onset },
  { name: 'iSpectrum', type: 'texture', get: (f) => f.audio.spectrum },
  { name: 'iWaveform', type: 'texture', get: (f) => f.audio.waveform },

  // --- audio: sidechain bus ---
  { name: 'iScLevel', type: 'float', get: (f) => f.sidechain.level },
  { name: 'iScLow', type: 'float', get: (f) => f.sidechain.low },
  { name: 'iScMid', type: 'float', get: (f) => f.sidechain.mid },
  { name: 'iScHigh', type: 'float', get: (f) => f.sidechain.high },
  { name: 'iScOnset', type: 'float', get: (f) => f.sidechain.onset },
  { name: 'iScSpectrum', type: 'texture', get: (f) => f.sidechain.spectrum },

  // --- MIDI ---
  { name: 'iNoteCount', type: 'float', get: (f) => f.midi.heldCount },
  { name: 'iLastNote', type: 'float', get: (f) => f.midi.lastNote },
  { name: 'iLastVelocity', type: 'float', get: (f) => f.midi.lastVelocity },
  { name: 'iNoteAge', type: 'float', get: (f) => f.midi.noteAge },
  { name: 'iMidiLevel', type: 'float', get: (f) => f.midi.level },
  /** 128 × 1。texelFetch(iNotes, ivec2(note, 0), 0).r = その note の envelope。 */
  { name: 'iNotes', type: 'texture', get: (f) => f.midi.envelopes },
];

/** param の key → uniform 名。intensity → pIntensity。 */
export function paramUniformName(key: string): string {
  return `p${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

/** automation param を 1 つずつ float uniform にする (値は denormalized)。 */
export function paramUniforms<P extends string>(
  params: Record<P, BoundParam>,
): UniformSpec<Frame<P>>[] {
  return (Object.keys(params) as P[]).map((key) => ({
    name: paramUniformName(key),
    type: 'float',
    get: (f: Frame<P>) => f.params[key],
  }));
}
