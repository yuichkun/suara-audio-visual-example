/** Pure clock math: DAW playhead / web fake clock → shader uniforms. */

export interface DawClockInput {
  positionSamples: number;
  sampleRate: number;
  tempo: number;
  timeSigNum: number;
  isPlaying: boolean;
}

export interface ClockUniforms {
  iTime: number;
  iBeat: number;
  iBar: number;
  iTempo: number;
  iPlaying: number;
}

export function packClock(input: DawClockInput): ClockUniforms {
  const seconds = input.sampleRate > 0 ? input.positionSamples / input.sampleRate : 0;
  const beats = seconds * (input.tempo / 60);
  const barLen = Math.max(1, input.timeSigNum);
  return {
    iTime: seconds,
    iBeat: beats,
    iBar: beats / barLen,
    iTempo: input.tempo,
    iPlaying: input.isPlaying ? 1 : 0,
  };
}

export interface WebClock {
  setPlaying(playing: boolean): void;
  tick(dt: number): void;
  pack(opts: { tempo: number; timeSigNum: number }): ClockUniforms;
}

/** Synthetic transport clock for web runtime (positionSamples stays 0 on SDK). */
export function createWebClock(): WebClock {
  let playing = false;
  let time = 0;
  return {
    setPlaying(p) {
      playing = p;
    },
    tick(dt) {
      if (playing) time += dt;
    },
    pack({ tempo, timeSigNum }) {
      const beats = time * (tempo / 60);
      const barLen = Math.max(1, timeSigNum);
      return {
        iTime: time,
        iBeat: beats,
        iBar: beats / barLen,
        iTempo: tempo,
        iPlaying: playing ? 1 : 0,
      };
    },
  };
}
