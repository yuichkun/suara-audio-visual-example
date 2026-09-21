#!/usr/bin/env node
/**
 * create-suara-av — Suara の audio visual plugin project を scaffold する。
 * (Suara 本体の CLI とは別物。できた project は `suara build dev` にそのまま渡せる)
 *
 * templates/<renderer>/ がそのまま 1 つの完結した project になっている。やることは
 * それを copy して、__NAME__ などの placeholder を埋め、plugin の uuid を振るだけ。
 */
import { cli, define } from 'gunshi';
import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), 'templates');
const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
/** placeholder を埋める対象 (kit や sdk の中身は触らない)。 */
const PLACEHOLDER_FILES = ['suara.json', 'package.json', 'index.html', 'README.md'];

const renderers = readdirSync(TEMPLATES).filter((d) => statSync(join(TEMPLATES, d)).isDirectory());

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

    cpSync(join(TEMPLATES, renderer), outDir, { recursive: true });
    fillPlaceholders(outDir, {
      NAME: name,
      SLUG: name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
      // suara.json の文字列の中に入るので JSON として escape しておく
      VENDOR: JSON.stringify(ctx.values.vendor).slice(1, -1),
      PROCESSOR_UUID: newUuid(),
      CONTROLLER_UUID: newUuid(),
    });

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
