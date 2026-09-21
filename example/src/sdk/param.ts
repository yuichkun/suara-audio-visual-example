// useParam(id, opts) — DAW automation を runtime 抽象で供給する。
//   VST runtime: read  = broker automation SAB を rAF drain → handle.value 更新、
//                write = knob gesture を param-write SAB に書く
//                        (= broker → performEdit → DAW automation lane 録音)。
//   web runtime: DAW が無いので read/write 経路なし = knob が唯一の source (local state)。
// range/log 変換はここだけ (= VST 境界は常に normalized 0..1)。
// ⚠️ id は controller の addParameter tag と SSoT: synth 0..5、 saturator 100..102。

import { runtime } from './runtime';
import { drainRing, writeRingEvent } from './ring';

export interface ParamOptions {
  min: number;
  max: number;
  default: number;
  log?: boolean;
}

export interface ParamHandle {
  /** denormalized 現在値。knob / worklet はこれを読む。 */
  readonly value: number;
  /** gesture 開始 (= VST: beginEdit 記録)。 */
  begin(): void;
  /** 値更新 (denormalized、 knob ドラッグ等)。value 更新 + VST: performEdit 記録。 */
  setFromUser(v: number): void;
  /** gesture 終了 (= VST: endEdit 記録)。 */
  end(): void;
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}
function toNorm(v: number, o: ParamOptions): number {
  const t = o.log
    ? Math.log(v / o.min) / Math.log(o.max / o.min)
    : (v - o.min) / (o.max - o.min);
  return clamp01(t);
}
function toDenorm(t: number, o: ParamOptions): number {
  const c = clamp01(t);
  return o.log ? o.min * Math.pow(o.max / o.min, c) : o.min + (o.max - o.min) * c;
}

// ~10s @60fps を取得再試行の上限に (= midi.ts と同方針、 boot race self-heal)。
const MAX_ACQUIRE_FRAMES = 600;

// --- VST automation read: 単一 SAB drainer、 param_id で dispatch ---
const readListeners = new Map<number, (normalized: number) => void>();
let readStarted = false;

function ensureReadDrain(): void {
  if (readStarted) return;
  readStarted = true;
  let frames = 0;
  const start = (): void => {
    let view: Int32Array;
    try {
      const sab = new SuaraDawAutomation().buffer as unknown as SharedArrayBuffer;
      view = new Int32Array(sab);
    } catch {
      // broker automation stream not ready yet (= async 注入の boot race)。
      // 諦めず次フレームで再試行 (= 注入が届いたら自動で automation read が動く)。
      if (++frames <= MAX_ACQUIRE_FRAMES) requestAnimationFrame(start);
      return;
    }
    let tail = 0;
    const poll = (): void => {
      tail = drainRing(view, tail, (paramId, _sampleOffset, valueMicro) => {
        const cb = readListeners.get(paramId);
        if (cb) cb(valueMicro / 1e6);
      });
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  };
  start();
}

// --- VST automation write: 単一 param-write SAB (renderer = producer) ---
let writeView: Int32Array | null = null;
function paramWriteView(): Int32Array | null {
  if (writeView) return writeView;
  try {
    const sab = new SuaraDawParamWrite().buffer as unknown as SharedArrayBuffer;
    writeView = new Int32Array(sab);
  } catch {
    // 未注入 — cache せず次の gesture で再試行 (= knob 操作は boot より後なので
    // 通常は初回で取得できるが、 万一の race でも write が永久 dead にならない)。
    return null;
  }
  return writeView;
}

export function useParam(id: number, opts: ParamOptions): ParamHandle {
  const state = { value: opts.default };

  if (runtime.isVst) {
    ensureReadDrain();
    readListeners.set(id, (normalized) => {
      state.value = toDenorm(normalized, opts);
    });
  }

  const writePhase = (phase: number, normalized: number): void => {
    if (!runtime.isVst) return;
    const view = paramWriteView();
    if (view) {
      writeRingEvent(view, id, phase, Math.round(clamp01(normalized) * 1e6), 0);
    }
  };

  return {
    get value(): number {
      return state.value;
    },
    begin(): void {
      writePhase(0, toNorm(state.value, opts));
    },
    setFromUser(v: number): void {
      state.value = v;
      writePhase(1, toNorm(v, opts));
    },
    end(): void {
      writePhase(2, toNorm(state.value, opts));
    },
  };
}
