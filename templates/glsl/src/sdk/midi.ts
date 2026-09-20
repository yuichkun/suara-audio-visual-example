// useMidi() — DAW MIDI を runtime 抽象で供給する。
//   VST runtime: broker が書く SuaraDawMidi.buffer (= SAB ring) を wrap。
//   web runtime: SDK が同じ layout の SharedArrayBuffer を自前確保 (= helper UI が書く)。
// どちらも consumer (= worklet / GUI) には同一の sab / reactive interface を見せる。
//
// ⚠️ boot race 対策 (self-heal): VST runtime では broker の MIDI SAB が
// CreateMidiStream (= async mojo) で注入されるまで `new SuaraDawMidi()` は throw
// する。page の JS がその注入より先に走る (= cold first load で稀に起こる) と、
// useMidi() を同期で呼ぶ component の setup() ごと throw して GUI subtree が描画
// されなくなる (= INSTRUMENT カードが空になる既知症状)。なので throw を握って
// rAF で再試行し、 取れたら確定する。worklet 構築は whenReady() を await して
// SAB 確定後に行う。transport.ts / param.ts と同じ「注入待ちでも死なない」方針。

import { runtime } from './runtime';
import { MIDI_RING_BYTES, RING_CAPACITY, SLOT_CAPACITY, drainMidi, writeMidiEvent } from './ring';

export interface MidiNoteEvent {
  note: number;
  velocity: number; // 0..1
  sampleOffset: number;
}

export type MidiEventName = 'noteon' | 'noteoff';
type Listener = (e: MidiNoteEvent) => void;

export interface MidiHandle {
  /** worklet に processorOptions で渡す MIDI ring。両 runtime 同一 layout。
   *  ⚠️ VST では注入待ちがあるので、worklet 構築前に whenReady() を await して
   *  解決値を使うこと (= ready 前に読むと throw)。 */
  readonly sab: SharedArrayBuffer;
  /** MIDI SAB が使用可能になるまで待つ (= VST: broker region 注入待ち / web: 即時)。
   *  解決値 = worklet に渡す SAB。 */
  whenReady(): Promise<SharedArrayBuffer>;
  /** 現在押されている note の Set (= GUI 鍵盤ハイライト等)。 */
  readonly activeNotes: Set<number>;
  on(name: MidiEventName, cb: Listener): void;
  off(name: MidiEventName, cb: Listener): void;
  /** web runtime のみ: helper UI が virtual note を流し込む (= VST では broker が供給、undefined)。 */
  pushNote?: (type: 0 | 1, note: number, velocity: number, sampleOffset?: number) => void;
}

// ~10s @60fps を再試行上限に (= 無限 rAF を避ける安全網。実際は注入は数十 ms で届く)。
const MAX_ACQUIRE_FRAMES = 600;

let handle: MidiHandle | null = null;

export function useMidi(): MidiHandle {
  if (!handle) handle = create();
  return handle;
}

function create(): MidiHandle {
  const activeNotes = new Set<number>();
  const onListeners: Listener[] = [];
  const offListeners: Listener[] = [];
  let tail = 0;

  let sab: SharedArrayBuffer | null = null;
  let view: Int32Array | null = null;
  let keepAlive: unknown = null; // VST: SuaraDawMidi object を GC させない

  let resolveReady!: (sab: SharedArrayBuffer) => void;
  const readyPromise = new Promise<SharedArrayBuffer>((r) => {
    resolveReady = r;
  });

  function commit(acquired: SharedArrayBuffer, alive: unknown): void {
    sab = acquired;
    keepAlive = alive;
    void keepAlive;
    view = new Int32Array(acquired);
    resolveReady(acquired);
  }

  function localSab(): SharedArrayBuffer {
    const local = new SharedArrayBuffer(MIDI_RING_BYTES);
    new Int32Array(local)[SLOT_CAPACITY] = RING_CAPACITY;
    return local;
  }

  if (runtime.isVst) {
    let frames = 0;
    const tryAcquire = (): void => {
      try {
        const midi = new SuaraDawMidi();
        // IDL 型は ArrayBuffer ([AllowShared])、 runtime は SharedArrayBuffer。
        commit(midi.buffer as unknown as SharedArrayBuffer, midi);
      } catch {
        if (++frames <= MAX_ACQUIRE_FRAMES) {
          requestAnimationFrame(tryAcquire); // region 未注入 — 次フレームで再試行
        } else {
          // 安全網: ここまで来ないはずだが、 来たら detached buffer で UI/audio を
          // 生かす (= MIDI は reload まで非活性、 ただし hang/crash しない)。
          console.warn(
            '[suara] DAW MIDI region not injected after retries; MIDI inactive until reload',
          );
          commit(localSab(), null);
        }
      }
    };
    tryAcquire();
  } else {
    if (!globalThis.crossOriginIsolated) {
      throw new Error('[suara] web runtime needs crossOriginIsolated (COOP/COEP) for SharedArrayBuffer');
    }
    commit(localSab(), null);
  }

  function poll(): void {
    if (view) {
      tail = drainMidi(view, tail, (type, pitch, velMilli, sampleOffset) => {
        const e: MidiNoteEvent = { note: pitch, velocity: velMilli / 1000, sampleOffset };
        if (type === 0) {
          activeNotes.add(pitch);
          for (const cb of onListeners) cb(e);
        } else {
          activeNotes.delete(pitch);
          for (const cb of offListeners) cb(e);
        }
      });
    }
    requestAnimationFrame(poll);
  }
  requestAnimationFrame(poll);

  const h: MidiHandle = {
    get sab(): SharedArrayBuffer {
      if (!sab) {
        throw new Error('[suara] MIDI SAB not ready — await useMidi().whenReady() before reading .sab');
      }
      return sab;
    },
    whenReady: () => readyPromise,
    activeNotes,
    on(name, cb) {
      (name === 'noteon' ? onListeners : offListeners).push(cb);
    },
    off(name, cb) {
      const list = name === 'noteon' ? onListeners : offListeners;
      const i = list.indexOf(cb);
      if (i >= 0) list.splice(i, 1);
    },
  };

  if (runtime.isWeb) {
    h.pushNote = (type, note, velocity, sampleOffset = 0) => {
      if (view) writeMidiEvent(view, type, note, Math.round(velocity * 1000), sampleOffset);
    };
  }
  return h;
}
