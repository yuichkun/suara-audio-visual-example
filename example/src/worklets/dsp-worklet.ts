// SuaraVisual DSP — passthrough so DAW audio reaches AnalyserNode + output.
class SuaraDsp extends AudioWorkletProcessor {
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0];
    const output = outputs[0];
    if (!output) return true;
    for (let ch = 0; ch < output.length; ch++) {
      const inCh = input?.[ch];
      const outCh = output[ch];
      if (!outCh) continue;
      if (inCh) outCh.set(inCh);
      else outCh.fill(0);
    }
    return true;
  }
}

registerProcessor('suara-dsp', SuaraDsp);

export {};
