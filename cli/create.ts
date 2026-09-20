#!/usr/bin/env node
/**
 * create-suara-av — Suara の audio visual plugin project を scaffold する。
 * (Suara 本体の CLI とは別物。できた project は `suara build dev` にそのまま渡せる)
 *
 * project は 2 つの材料から組み立てる:
 *   templates/<renderer>/  その project 固有のファイル (main.ts / params / shader / suara.json ...)
 *   このリポの root        共有する土台 (SHARED)。demo と同じものを verbatim で copy する
 * なので kit を直せば、以後 scaffold される project にもそのまま入る。
 */
import { cli, define } from 'gunshi';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = join(ROOT, 'templates');
const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;

/** root から verbatim で copy するもの (= demo と scaffold で共有する土台)。 */
const SHARED = [
  'src/sdk',
  'src/kit',
  'src/worklets',
  'src/vite-env.d.ts',
  'vite.config.ts',
  'tsconfig.worklet.json',
  '.gitignore',
];

/** scaffold した project の devDependencies。version は root の package.json に合わせる。 */
const DEV_DEPENDENCIES = ['@types/audioworklet', '@types/node', 'typescript', 'vite'];

const renderers = readdirSync(TEMPLATES).filter((d) => statSync(join(TEMPLATES, d)).isDirectory());

function newUuid(): string {
  return randomUUID().replaceAll('-', '').toUpperCase();
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walkFiles(p) : [p];
  });
}

function fillPlaceholders(dir: string, values: Record<string, string>): void {
  for (const file of walkFiles(dir)) {
    const before = readFileSync(file, 'utf8');
    const after = before.replace(/__([A-Z_]+)__/g, (m, key: string) => values[key] ?? m);
    if (after !== before) writeFileSync(file, after);
  }
}

function packageJson(slug: string): unknown {
  const rootPkg = readJson(join(ROOT, 'package.json'));
  const rootDev = rootPkg['devDependencies'] as Record<string, string>;
  return {
    name: slug,
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      'prod:web': 'vite build',
      typecheck: 'tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.worklet.json',
      'build:dev': 'suara build dev',
      'build:prod': 'suara build prod',
      'register:dev': 'suara register dev',
      'register:prod': 'suara register prod',
      'unregister:dev': 'suara unregister dev',
      'unregister:prod': 'suara unregister prod',
    },
    devDependencies: Object.fromEntries(
      DEV_DEPENDENCIES.map((name) => {
        const version = rootDev[name];
        if (!version) throw new Error(`root package.json に ${name} が無い`);
        return [name, version];
      }),
    ),
  };
}

/** root の tsconfig から、テストや CLI 用の設定を外したもの。 */
function tsconfigJson(): unknown {
  const ts = readJson(join(ROOT, 'tsconfig.json'));
  const compilerOptions = { ...(ts['compilerOptions'] as Record<string, unknown>) };
  compilerOptions['types'] = ['vite/client'];
  return { compilerOptions, include: ['src'], exclude: ['src/worklets'] };
}

const command = define({
  name: 'create-suara-av',
  description: 'Scaffold a Suara audio-visual plugin project',
  args: {
    name: {
      type: 'positional',
      description: 'PascalCase plugin name',
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
    out: {
      type: 'string',
      short: 'o',
      description: 'Output directory (default: ./<name>)',
    },
  },
  run(ctx) {
    const name = String(ctx.values.name ?? '');
    if (!NAME_RE.test(name)) {
      throw new Error(`name must be PascalCase ASCII (got "${name}")`);
    }
    const renderer = ctx.values.renderer;
    if (!renderers.includes(renderer)) {
      throw new Error(`unknown renderer "${renderer}" (available: ${renderers.join(', ')})`);
    }
    const outDir = resolve(ctx.values.out ?? join(process.cwd(), name));
    if (existsSync(outDir)) {
      throw new Error(`output exists: ${outDir}`);
    }
    const slug = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

    mkdirSync(outDir, { recursive: true });
    cpSync(join(TEMPLATES, renderer), outDir, { recursive: true });
    fillPlaceholders(outDir, {
      NAME: name,
      // suara.json の文字列の中に入るので JSON として escape しておく
      VENDOR: JSON.stringify(ctx.values.vendor).slice(1, -1),
      PROCESSOR_UUID: newUuid(),
      CONTROLLER_UUID: newUuid(),
    });
    for (const path of SHARED) {
      cpSync(join(ROOT, path), join(outDir, path), { recursive: true });
    }
    writeJson(join(outDir, 'package.json'), packageJson(slug));
    writeJson(join(outDir, 'tsconfig.json'), tsconfigJson());

    console.log(`Created ${outDir} (renderer=${renderer})`);
    console.log(`Next: cd ${outDir} && npm install && npm run dev`);
    console.log(`Then: suara build dev && suara register dev`);
  },
});

await cli(process.argv.slice(2), command, {
  name: 'create-suara-av',
  version: '0.1.0',
  description: 'Scaffold Suara AV plugin projects',
});
