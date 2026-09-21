#!/usr/bin/env node
/**
 * create-suara-av — Suara の audio visual plugin project を scaffold する。
 * (Suara 本体の CLI とは別物。できた project は `suara build dev` にそのまま渡せる)
 *
 *   create-suara-av ../MyVJ     → ../MyVJ に project を作る。plugin 名は最後の部分 (MyVJ)
 *
 * templates/<renderer>/ がそのまま 1 つの完結した project になっている。やることは
 * それを copy して、__NAME__ などの placeholder を埋め、plugin の uuid を振るだけ。
 */
import { cli, define } from 'gunshi';
import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), 'templates');
const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
/** placeholder を埋める対象 (kit や sdk の中身は触らない)。 */
const PLACEHOLDER_FILES = ['suara.json', 'package.json', 'index.html', 'README.md'];

const renderers = readdirSync(TEMPLATES).filter((d) => statSync(join(TEMPLATES, d)).isDirectory());

// `npm run create -- ../MyVJ` は npm が cwd を repo の root に変えてから実行するので、
// 相対パスはコマンドを打った場所 (npm が INIT_CWD に入れてくれる) から解決する
const invokedFrom = process.env['INIT_CWD'] ?? process.cwd();

const USAGE = 'usage: npm run create -- <dir>   (e.g. npm run create -- ../MyVJ)';

function newUuid(): string {
  return randomUUID().replaceAll('-', '').toUpperCase();
}

function fillPlaceholders(dir: string, values: Record<string, string>): void {
  for (const name of PLACEHOLDER_FILES) {
    const file = join(dir, name);
    const before = readFileSync(file, 'utf8');
    const after = before.replace(/__([A-Z_]+)__/g, (m, key: string) => values[key] ?? m);
    if (after !== before) writeFileSync(file, after);
  }
}

const command = define({
  name: 'create-suara-av',
  description: 'Scaffold a Suara audio-visual plugin project',
  args: {
    dir: {
      type: 'positional',
      description: 'Directory to create. Its last segment becomes the plugin name (PascalCase), e.g. ../MyVJ',
    },
    renderer: {
      type: 'string',
      default: 'glsl',
      short: 'r',
      description: `Template under templates/ (available: ${renderers.join(', ')})`,
    },
    vendor: {
      type: 'string',
      default: 'Suara',
      description: 'Plugin vendor name',
    },
  },
  run(ctx) {
    const dirArg = String(ctx.values.dir ?? '');
    if (!dirArg) {
      throw new Error(USAGE);
    }
    const outDir = resolve(invokedFrom, dirArg);
    const name = basename(outDir);
    if (!NAME_RE.test(name)) {
      throw new Error(
        `the directory name becomes the plugin name, so it must be PascalCase ASCII (got "${name}", e.g. ../MyVJ)`,
      );
    }
    const renderer = ctx.values.renderer;
    if (!renderers.includes(renderer)) {
      throw new Error(`unknown renderer "${renderer}" (available: ${renderers.join(', ')})`);
    }
    if (existsSync(outDir)) {
      throw new Error(`already exists: ${outDir}`);
    }

    cpSync(join(TEMPLATES, renderer), outDir, { recursive: true });
    fillPlaceholders(outDir, {
      NAME: name,
      SLUG: name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
      // suara.json の文字列の中に入るので JSON として escape しておく
      VENDOR: JSON.stringify(ctx.values.vendor).slice(1, -1),
      PROCESSOR_UUID: newUuid(),
      CONTROLLER_UUID: newUuid(),
    });

    const shown = relative(invokedFrom, outDir) || '.';
    console.log(`Created ${name} in ${outDir}`);
    console.log(`Next: cd ${shown} && npm install && npm run dev`);
    console.log(`Then: suara build dev && suara register dev`);
  },
});

try {
  await cli(process.argv.slice(2), command, {
    name: 'create-suara-av',
    version: '0.1.0',
    description: 'Scaffold Suara AV plugin projects',
    // 引数の不足などは gunshi が表示して終了コード 0 で抜けるので、エラーとして扱う
    renderValidationErrors: async (_ctx, error) => {
      throw new Error(`${error.errors.map((e: unknown) => (e instanceof Error ? e.message : String(e))).join('; ')}\n${USAGE}`);
    },
  });
} catch (e) {
  // 入力ミスは stack trace ではなく 1 行で伝える
  console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
}
