// MIDI SAB ring buffer の layout (= SSoT)。
// broker (C++ suara_runtime_pocv2.mm) と worklet (synth-worklet.js) が
// 同じ layout を別々に持つ。ここを基準に揃える。
//
// layout (Int32):
//   [0] write_seq   producer が monotonic に増やす (Atomics, release publish)
//   [1] capacity    = RING_CAPACITY
//   [2..3] reserved
//   [4 + i*4 + {0,1,2,3}] = { type(0=NoteOn/1=NoteOff), pitch, velocity_milli(0..1000), sampleOffset }

export const RING_CAPACITY = 256;
export const HEADER_INTS = 4;
export const EVENT_INTS = 4;

export const SLOT_WRITE_SEQ = 0;
export const SLOT_CAPACITY = 1;

export const EV_TYPE = 0;
export const EV_PITCH = 1;
export const EV_VEL_MILLI = 2;
export const EV_SAMPLE_OFFSET = 3;

export const MIDI_RING_BYTES = (HEADER_INTS + RING_CAPACITY * EVENT_INTS) * 4;

export type MidiEventSink = (
  type: number,
  pitch: number,
  velMilli: number,
  sampleOffset: number,
) => void;

/** reader: tail から write_seq まで drain して cb に渡し、新しい tail を返す。 */
export function drainMidi(view: Int32Array, tail: number, cb: MidiEventSink): number {
  const writeSeq = Atomics.load(view, SLOT_WRITE_SEQ);
  const capacity = view[SLOT_CAPACITY] || RING_CAPACITY;
  while (tail < writeSeq) {
    const base = HEADER_INTS + (tail % capacity) * EVENT_INTS;
    cb(
      view[base + EV_TYPE] ?? 0,
      view[base + EV_PITCH] ?? 0,
      view[base + EV_VEL_MILLI] ?? 0,
      view[base + EV_SAMPLE_OFFSET] ?? 0,
    );
    tail++;
  }
  return tail;
}

/** producer: web runtime で helper UI が virtual note を 1 件書く (= VST では broker が C++ で同等)。 */
export function writeMidiEvent(
  view: Int32Array,
  type: number,
  pitch: number,
  velMilli: number,
  sampleOffset: number,
): void {
  const writeSeq = Atomics.load(view, SLOT_WRITE_SEQ);
  const capacity = view[SLOT_CAPACITY] || RING_CAPACITY;
  const base = HEADER_INTS + (writeSeq % capacity) * EVENT_INTS;
  view[base + EV_TYPE] = type;
  view[base + EV_PITCH] = pitch;
  view[base + EV_VEL_MILLI] = velMilli;
  view[base + EV_SAMPLE_OFFSET] = sampleOffset;
  Atomics.store(view, SLOT_WRITE_SEQ, writeSeq + 1);
}

// 段3d: the automation-read ring and the param-write ring share this exact
// 4-int event layout (header [write_seq, capacity], events of 4 int32). Reuse
// the same drain/write helpers; the 4 ints are reinterpreted per carrier
// (automation: [param_id, sample_offset, value_micro, _]; param-write:
// [param_id, phase, value_micro, _]).
export const EVENT_RING_BYTES = MIDI_RING_BYTES;
export { drainMidi as drainRing, writeMidiEvent as writeRingEvent };
