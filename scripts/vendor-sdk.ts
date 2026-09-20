#!/usr/bin/env npx tsx
/**
 * Copy poc_v2/sdk/src into src/sdk/, drop Vue/ARA/helpers, strip `reactive`.
 * Re-run when upstream SDK changes. Never re-copy raw poc_v2 into templates.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir =
  process.env['SUARA_SDK_SRC'] ??
  join(root, '..', 'suara', 'poc_v2', 'sdk', 'src');
const dstDir = join(root, 'src', 'sdk');

if (!existsSync(srcDir)) {
  console.error(`SDK source not found: ${srcDir}`);
  console.error('Set SUARA_SDK_SRC or place suara/poc_v2 next to this repo.');
  process.exit(1);
}

rmSync(dstDir, { recursive: true, force: true });
mkdirSync(dstDir, { recursive: true });
cpSync(srcDir, dstDir, { recursive: true });

// Drop AV-unused pieces
rmSync(join(dstDir, 'ara.ts'), { force: true });
rmSync(join(dstDir, 'helper'), { recursive: true, force: true });

function rewrite(path: string, fn: (c: string) => string): void {
  writeFileSync(path, fn(readFileSync(path, 'utf8')));
}

rewrite(join(dstDir, 'index.ts'), (c) =>
  c
    .replace(/\nexport \{\n  useAra,[\s\S]*?\} from '\.\/ara';\n/, '\n')
    .replace(/\nexport type \{\n  AraHandle,[\s\S]*?\} from '\.\/ara';\n/, '\n'),
);

rewrite(join(dstDir, 'midi.ts'), (c) =>
  c
    .replace(/import \{ reactive \} from 'vue';\n/, '')
    .replace(/const activeNotes = reactive\(new Set<number>\(\)\);/, 'const activeNotes = new Set<number>();')
    .replace(
      /\/\*\* 現在押されている note の reactive Set \(= GUI 鍵盤ハイライト等\)。 \*\//,
      '/** 現在押されている note の Set (= GUI 鍵盤ハイライト等)。 */',
    )
    .replace(/\bself\.crossOriginIsolated\b/g, 'globalThis.crossOriginIsolated'),
);

rewrite(join(dstDir, 'transport.ts'), (c) =>
  c
    .replace(/import \{ reactive \} from 'vue';\n/, '')
    .replace(
      /const state = reactive<TransportState>\(\{[\s\S]*?\}\);/,
      `const state: TransportState = {
    isPlaying: false,
    tempo: 120,
    isRecording: false,
    positionSamples: 0,
    timeSigNum: 4,
    timeSigDenom: 4,
  };`,
    )
    .replace(
      /\/\/ consumer \(= GUI\) は handle\.state を reactive に読むだけ \(= 両 runtime 同一\)。/,
      '// consumer (= GUI) は handle.state を毎フレーム読むだけ (= 両 runtime 同一)。',
    ),
);

rewrite(join(dstDir, 'param.ts'), (c) =>
  c
    .replace(/import \{ reactive \} from 'vue';\n/, '')
    .replace(
      /const state = reactive<\{ value: number \}>\(\{ value: opts\.default \}\);/,
      'const state = { value: opts.default };',
    )
    .replace(
      /\/\*\* denormalized 現在値 \(reactive\)。knob \/ worklet はこれを読む。 \*\//,
      '/** denormalized 現在値。knob / worklet はこれを読む。 */',
    ),
);

rewrite(join(dstDir, 'ring.ts'), (c) =>
  c.replace(
    /cb\(view\[base \+ EV_TYPE\], view\[base \+ EV_PITCH\], view\[base \+ EV_VEL_MILLI\], view\[base \+ EV_SAMPLE_OFFSET\]\);/,
    `cb(
      view[base + EV_TYPE] ?? 0,
      view[base + EV_PITCH] ?? 0,
      view[base + EV_VEL_MILLI] ?? 0,
      view[base + EV_SAMPLE_OFFSET] ?? 0,
    );`,
  ),
);

rewrite(join(dstDir, 'transport.ts'), (c) =>
  c.replace(
    /const st = view\[base \+ 0\];\n      state\.isPlaying = \(st & ST_PLAYING\) !== 0;\n      state\.isRecording = \(st & ST_RECORDING\) !== 0;\n      if \(st & ST_TEMPO_VALID\) \{\n        state\.tempo = view\[base \+ 1\] \/ 1000;\n      \}\n      if \(st & ST_TIMESIG_VALID\) \{\n        state\.timeSigNum = view\[base \+ 2\];\n        state\.timeSigDenom = view\[base \+ 3\];\n      \}\n      \/\/ int64 projectTimeSamples = hi \* 2\^32 \+ lo \(lo as unsigned 32-bit\)\.\n      const lo = view\[base \+ 4\] >>> 0;\n      const hi = view\[base \+ 5\];\n      state\.positionSamples = hi \* 4294967296 \+ lo;/,
    `const st = view[base + 0] ?? 0;
      state.isPlaying = (st & ST_PLAYING) !== 0;
      state.isRecording = (st & ST_RECORDING) !== 0;
      if (st & ST_TEMPO_VALID) {
        state.tempo = (view[base + 1] ?? 0) / 1000;
      }
      if (st & ST_TIMESIG_VALID) {
        state.timeSigNum = view[base + 2] ?? 4;
        state.timeSigDenom = view[base + 3] ?? 4;
      }
      // int64 projectTimeSamples = hi * 2^32 + lo (lo as unsigned 32-bit).
      const lo = (view[base + 4] ?? 0) >>> 0;
      const hi = view[base + 5] ?? 0;
      state.positionSamples = hi * 4294967296 + lo;`,
  ),
);

console.log(`vendored SDK → ${dstDir} (Vue/ARA/helpers stripped)`);
