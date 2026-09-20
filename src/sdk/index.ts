// @suara/sdk (PoC) — userland はここから import する。
// 同じ import が VST runtime でも web runtime でも動く (= 供給源を SDK が抽象)。

export { runtime } from './runtime';
export type { RuntimeKind } from './runtime';

export { useMidi } from './midi';
export type { MidiHandle, MidiNoteEvent, MidiEventName } from './midi';

export { useTransport } from './transport';
export type { TransportHandle, TransportState } from './transport';

export { useParam } from './param';
export type { ParamHandle, ParamOptions } from './param';

export { createDawInput, configureWebInput } from './daw-input';
export type { DawInputOptions, WebInputSource, Bus } from './daw-input';

