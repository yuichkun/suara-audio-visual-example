// VST runtime (= hacked chromium) で chromium が expose する IDL global.
// web runtime には存在しない (= runtime.isVst で guard してから使う)。
// 出典 = third_party/blink/renderer/modules/mediastream/suara_daw_{midi,input}.idl

declare class SuaraDawMidi {
  constructor();
  // IDL は [AllowShared] ArrayBuffer。runtime では SharedArrayBuffer。
  readonly buffer: ArrayBuffer;
}

declare class SuaraDawInput extends MediaStreamTrack {
  // bus: 0 = main, 1 = sidechain (kAux). Optional, defaults to main.
  constructor(bus?: number);
}

// 段3c/3d: transport (read snapshot ring) / automation (read event ring) /
// param-write (renderer-written event ring)。 全て shmem-backed SharedArrayBuffer。
declare class SuaraDawTransport {
  constructor();
  readonly buffer: ArrayBuffer;
}

declare class SuaraDawAutomation {
  constructor();
  readonly buffer: ArrayBuffer;
}

declare class SuaraDawParamWrite {
  constructor();
  readonly buffer: ArrayBuffer;
}

// ARA PoC: モデル snapshot + 入出力アリーナ + per-instance cell。
// この instance が ARA bind されるまで constructor は throw する
// (= SDK の useAra() が rAF retry で self-heal)。
declare class SuaraDawAra {
  constructor();
  readonly modelBuffer: ArrayBuffer;
  readonly inputBuffer: ArrayBuffer;
  readonly outputBuffer: ArrayBuffer;
  readonly instanceBuffer: ArrayBuffer;
}
