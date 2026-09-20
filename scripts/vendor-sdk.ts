#!/usr/bin/env node
/**
 * Suara 本体の SDK (poc_v2/sdk/src) を src/sdk/ に vendoring し直す。
 * この repo は Vue を使わないので、copy した後に Vue (`reactive`) と ARA / helper を外し、
 * この repo の厳格な tsc (noUncheckedIndexedAccess) を通すための最小の書き換えを当てる。
 *
 * 書き換えは全部「必ず 1 箇所に当たること」を確認する。upstream が変わって当たらなくなったら
 * 黙って素通しせずに失敗する (= その時はここの pattern を直す)。
 *
 *   npm run vendor:sdk
 *   SUARA_SDK_SRC=/path/to/poc_v2/sdk/src npm run vendor:sdk
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = process.env['SUARA_SDK_SRC'] ?? join(root, '..', 'suara', 'poc_v2', 'sdk', 'src');
const dstDir = join(root, 'src', 'sdk');

if (!existsSync(srcDir)) {
  console.error(`SDK source not found: ${srcDir}`);
  console.error('Set SUARA_SDK_SRC or place suara/poc_v2 next to this repo.');
  process.exit(1);
}

type Patch = [from: string | RegExp, to: string];

function patch(file: string, patches: Patch[]): void {
  const path = join(dstDir, file);
  let content = readFileSync(path, 'utf8');
  for (const [from, to] of patches) {
    const next = content.replace(from, to);
    if (next === content) {
      throw new Error(`${file}: patch が当たらない (upstream が変わった?)\n  pattern: ${String(from)}`);
    }
    content = next;
  }
  writeFileSync(path, content);
}

const DROP_VUE_IMPORT: Patch = ["import { reactive } from 'vue';\n", ''];

rmSync(dstDir, { recursive: true, force: true });
mkdirSync(dstDir, { recursive: true });
cpSync(srcDir, dstDir, { recursive: true });

// AV では使わない
rmSync(join(dstDir, 'ara.ts'));
rmSync(join(dstDir, 'helper'), { recursive: true });

patch('index.ts', [
  [/\nexport \{\n  useAra,[\s\S]*?\} from '\.\/ara';\n/, '\n'],
  [/\nexport type \{\n  AraHandle,[\s\S]*?\} from '\.\/ara';\n/, '\n'],
]);

patch('midi.ts', [
  DROP_VUE_IMPORT,
  ['const activeNotes = reactive(new Set<number>());', 'const activeNotes = new Set<number>();'],
  ['note の reactive Set (= GUI', 'note の Set (= GUI'],
  [/\bself\.crossOriginIsolated\b/g, 'globalThis.crossOriginIsolated'],
]);

patch('transport.ts', [
  DROP_VUE_IMPORT,
  [/const state = reactive<TransportState>\((\{[\s\S]*?\})\);/, 'const state: TransportState = $1;'],
  ['handle.state を reactive に読むだけ', 'handle.state を毎フレーム読むだけ'],
  // noUncheckedIndexedAccess: view[i] は number | undefined
  ['const st = view[base + 0];', 'const st = view[base + 0] ?? 0;'],
  ['state.tempo = view[base + 1] / 1000;', 'state.tempo = (view[base + 1] ?? 0) / 1000;'],
  ['state.timeSigNum = view[base + 2];', 'state.timeSigNum = view[base + 2] ?? 4;'],
  ['state.timeSigDenom = view[base + 3];', 'state.timeSigDenom = view[base + 3] ?? 4;'],
  ['const lo = view[base + 4] >>> 0;', 'const lo = (view[base + 4] ?? 0) >>> 0;'],
  ['const hi = view[base + 5];', 'const hi = view[base + 5] ?? 0;'],
]);

patch('param.ts', [
  DROP_VUE_IMPORT,
  [
    'const state = reactive<{ value: number }>({ value: opts.default });',
    'const state = { value: opts.default };',
  ],
  ['現在値 (reactive)。knob', '現在値。knob'],
]);

patch('ring.ts', [
  [
    'cb(view[base + EV_TYPE], view[base + EV_PITCH], view[base + EV_VEL_MILLI], view[base + EV_SAMPLE_OFFSET]);',
    `cb(
      view[base + EV_TYPE] ?? 0,
      view[base + EV_PITCH] ?? 0,
      view[base + EV_VEL_MILLI] ?? 0,
      view[base + EV_SAMPLE_OFFSET] ?? 0,
    );`,
  ],
]);

console.log(`vendored SDK → ${dstDir} (Vue / ARA / helper を除去)`);
