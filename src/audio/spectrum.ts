export interface TimeDomainStats {
  rms: number;
  peak: number;
}

/** Analyse a time-domain buffer (e.g. from AnalyserNode.getFloatTimeDomainData). */
export function analyseTimeDomain(buf: Float32Array): TimeDomainStats {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const s = buf[i] ?? 0;
    sum += s * s;
    const a = Math.abs(s);
    if (a > peak) peak = a;
  }
  const rms = buf.length > 0 ? Math.sqrt(sum / buf.length) : 0;
  return { rms, peak };
}

/** Copy frequency bins into a normalized 0..1 Float32Array for GPU texture upload. */
export function binsToTextureData(freq: Uint8Array | Float32Array, out: Float32Array): void {
  const n = Math.min(freq.length, out.length);
  if (freq instanceof Uint8Array) {
    for (let i = 0; i < n; i++) out[i] = (freq[i] ?? 0) / 255;
  } else {
    for (let i = 0; i < n; i++) out[i] = Math.min(1, Math.max(0, freq[i] ?? 0));
  }
}

export interface HitTracker {
  update(rms: number): number;
}

/** Short onset envelope: spikes when rms jumps, then decays. */
export function createHitTracker(opts?: { threshold?: number; decay?: number }): HitTracker {
  const threshold = opts?.threshold ?? 0.15;
  const decay = opts?.decay ?? 0.85;
  let prev = 0;
  let hit = 0;
  return {
    update(rms: number): number {
      const delta = rms - prev;
      prev = rms;
      if (delta > threshold) {
        hit = Math.min(1, hit + delta * 2);
      } else {
        hit *= decay;
      }
      if (hit < 0.001) hit = 0;
      return hit;
    },
  };
}
