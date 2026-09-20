#!/usr/bin/env node
/**
 * create-suara-av — scaffold an AV plugin from templates/glsl (default).
 * Does NOT touch Suara's own CLI.
 */
import { cli, define } from 'gunshi';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;

function newUuid(): string {
  return randomUUID().replaceAll('-', '').toUpperCase();
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'release' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

function replaceInTree(dir: string, pairs: Array<[string | RegExp, string]>): void {
  for (const file of walkFiles(dir)) {
    if (!/\.(ts|js|json|html|md|frag|css)$/.test(file)) continue;
    let c = readFileSync(file, 'utf8');
    let changed = false;
    for (const [from, to] of pairs) {
      const next = typeof from === 'string' ? c.replaceAll(from, to) : c.replace(from, to);
      if (next !== c) {
        c = next;
        changed = true;
      }
    }
    if (changed) writeFileSync(file, c);
  }
}

function applyBind(projectDir: string, bind: Set<string>): void {
  // Minimal: if audio not bound, strip iSpectrum from wrapper comment in README only;
  // layout stays full for simplicity unless --bind is restrictive.
  if (bind.has('time') && bind.size === 1) {
    // time-only: simplify demo shader scene0 to not reference spectrum/midi
    const scene0 = join(projectDir, 'src/shaders/scene0.frag');
    if (existsSync(scene0)) {
      writeFileSync(
        scene0,
        `// Scene 0 — time only (--bind time)
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float wave = 0.5 + 0.5 * sin(uv.x * 12.0 + iTime * 3.0);
  fragColor = vec4(vec3(wave * 0.4 + 0.1), 1.0);
}
`,
      );
    }
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
      type: 'enum',
      choices: ['glsl', 'wgsl', 'typegpu', 'tsl'] as const,
      default: 'glsl',
      short: 'r',
      description: 'GPU renderer template (default: glsl)',
    },
    vendor: {
      type: 'string',
      default: 'Suara',
      description: 'Plugin vendor name',
    },
    bind: {
      type: 'string',
      short: 'b',
      default: 'time,audio,midi,beat,params',
      description: 'Comma-separated uniform groups to include',
    },
    out: {
      type: 'string',
      short: 'o',
      description: 'Output directory (default: ./<name>)',
    },
  },
  async run(ctx) {
    const name = String(ctx.values.name ?? '');
    if (!NAME_RE.test(name)) {
      throw new Error(`name must be PascalCase ASCII (got "${name}")`);
    }
    const renderer = ctx.values.renderer ?? 'glsl';
    if (renderer !== 'glsl') {
      throw new Error(`renderer "${renderer}" not shipped yet — use glsl`);
    }
    const vendor = String(ctx.values.vendor ?? 'Suara');
    const bind = new Set(
      String(ctx.values.bind ?? 'time,audio,midi,beat,params')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    const outDir = resolve(String(ctx.values.out ?? join(process.cwd(), name)));
    const templateDir = join(ROOT, 'templates', 'glsl');

    if (!existsSync(templateDir)) {
      throw new Error(`template missing: ${templateDir}`);
    }
    if (existsSync(outDir)) {
      throw new Error(`output exists: ${outDir}`);
    }

    mkdirSync(outDir, { recursive: true });
    cpSync(templateDir, outDir, { recursive: true });

    const proc = newUuid();
    const ctrl = newUuid();
    const slug = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

    replaceInTree(outDir, [
      ['SuaraVisual', name],
      ['suara-visual', slug],
      ['BDE53452E768424AB229CA2D4A0581DD', proc],
      ['6B312E446E8F41E7991CD59C48365984', ctrl],
      [/"vendor": "Suara"/, `"vendor": ${JSON.stringify(vendor)}`],
    ]);

    applyBind(outDir, bind);

    console.log(`Created ${outDir}`);
    console.log(`  renderer=${renderer} vendor=${vendor} bind=${[...bind].join(',')}`);
    console.log(`Next: cd ${outDir} && npm install && npm run dev`);
    console.log(`Then: suara build dev && suara register dev`);
  },
});

await cli(process.argv.slice(2), command, {
  name: 'create-suara-av',
  version: '0.1.0',
  description: 'Scaffold Suara AV plugin projects',
});
