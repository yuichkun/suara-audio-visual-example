// runtime 判定。VST runtime (= hacked chromium) にだけ存在する Suara global を
// feature-detect する。web runtime には存在しない。

export type RuntimeKind = 'vst' | 'web';

function detect(): RuntimeKind {
  return 'SuaraDawMidi' in globalThis ? 'vst' : 'web';
}

const kind = detect();

export const runtime = {
  kind,
  isVst: kind === 'vst',
  isWeb: kind === 'web',
} as const;
