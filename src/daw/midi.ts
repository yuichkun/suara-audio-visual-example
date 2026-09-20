export interface MidiUniformInput {
  activeNotes: ReadonlySet<number>;
  lastNote: number;
  lastVel: number;
}

export interface MidiUniforms {
  iNoteCount: number;
  iLastNote: number;
  iLastVel: number;
}

export function mapMidiToUniforms(input: MidiUniformInput): MidiUniforms {
  return {
    iNoteCount: input.activeNotes.size,
    iLastNote: input.lastNote,
    iLastVel: input.lastVel,
  };
}
