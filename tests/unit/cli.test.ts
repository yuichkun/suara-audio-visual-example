import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SHARED_PATHS } from '../../cli/scripts/shared.ts';

const root = join(fileURLToPath(import.meta.url), '../../..');
const template = join(root, 'cli/templates/glsl');
const node = process.execPath;

function runCreate(args: string[]) {
  return spawnSync(node, ['--experimental-strip-types', join(root, 'cli/create.ts'), ...args], {
    encoding: 'utf8',
    cwd: root,
  });
}

function walk(dir: string): string[] {
  const r = spawnSync('find', [dir, '-type', 'f', '-not', '-path', '*/node_modules/*'], { encoding: 'utf8' });
  return r.stdout.split('\n').filter(Boolean);
}

describe('Feature: scaffold CLI', () => {
  let dir: string;
  let out: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'suara-av-'));
    out = join(dir, 'ProbeVis');
    const r = runCreate(['ProbeVis', '--vendor', 'Yogo "Test"', '--out', out]);
    expect(r.status, r.stderr + r.stdout).toBe(0);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('suara.json に name / vendor / 新しい uuid が入る', () => {
    const manifest = JSON.parse(readFileSync(join(out, 'suara.json'), 'utf8'));
    expect(manifest.name).toBe('ProbeVis');
    expect(manifest.vendor).toBe('Yogo "Test"');
    expect(manifest.processorUuid).toMatch(/^[A-F0-9]{32}$/);
    expect(manifest.controllerUuid).toMatch(/^[A-F0-9]{32}$/);
    expect(manifest.processorUuid).not.toBe(manifest.controllerUuid);
    expect(JSON.parse(readFileSync(join(out, 'package.json'), 'utf8')).name).toBe('probe-vis');
  });

  it('template の中身がそのまま入り、placeholder は残らない', () => {
    const rel = (base: string) => walk(base).map((f) => f.slice(base.length)).sort();
    expect(rel(out)).toEqual(rel(template));
    for (const file of walk(out)) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/__[A-Z_]+__/);
    }
  });

  it('scaffold した project がそのまま typecheck を通る', () => {
    symlinkSync(join(root, 'node_modules'), join(out, 'node_modules'));
    const tsc = join(root, 'node_modules/typescript/bin/tsc');
    for (const project of ['tsconfig.json', 'tsconfig.worklet.json']) {
      const r = spawnSync(node, [tsc, '--noEmit', '-p', project], { encoding: 'utf8', cwd: out });
      expect(r.status, r.stdout + r.stderr).toBe(0);
    }
  }, 60_000);

  it('既にある dir には上書きしない', () => {
    const r = runCreate(['ProbeVis', '--out', out]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/output exists/);
  });

  it('PascalCase でない name / 存在しない renderer は弾く', () => {
    expect(runCreate(['probe-vis', '--out', join(dir, 'x')]).status).not.toBe(0);
    expect(runCreate(['Other', '--renderer', 'wgsl', '--out', join(dir, 'y')]).status).not.toBe(0);
  });
});

describe('Feature: example は template と同じ土台の上にある', () => {
  it.each(SHARED_PATHS)('%s が template と同一 (ズレたら npm run sync:example)', (path) => {
    expect(existsSync(join(root, 'example', path)), path).toBe(true);
    const r = spawnSync('diff', ['-r', join(template, path), join(root, 'example', path)], { encoding: 'utf8' });
    expect(r.stdout + r.stderr).toBe('');
  });
});
