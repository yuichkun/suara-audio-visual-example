import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '../../..');
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
    const demo = JSON.parse(readFileSync(join(root, 'suara.json'), 'utf8'));
    expect(manifest.name).toBe('ProbeVis');
    expect(manifest.vendor).toBe('Yogo "Test"');
    expect(manifest.processorUuid).toMatch(/^[A-F0-9]{32}$/);
    expect(manifest.controllerUuid).toMatch(/^[A-F0-9]{32}$/);
    expect(manifest.processorUuid).not.toBe(manifest.controllerUuid);
    expect(manifest.processorUuid).not.toBe(demo.processorUuid);
  });

  it('template 固有のファイルと共有の土台が両方入る', () => {
    for (const path of [
      'src/main.ts',
      'src/params.ts',
      'src/kit/signals/index.ts',
      'src/sdk/midi.ts',
      'src/worklets/dsp-worklet.ts',
      'vite.config.ts',
      'package.json',
    ]) {
      expect(existsSync(join(out, path)), path).toBe(true);
    }
    const pkg = JSON.parse(readFileSync(join(out, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('probe-vis');
  });

  it('placeholder が残っていない / shader や test が混ざっていない', () => {
    for (const file of walk(out)) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/__[A-Z_]+__/);
    }
    expect(walk(join(out, 'src/shaders')).filter((f) => f.endsWith('.frag'))).toEqual([]);
    expect(existsSync(join(out, 'tests'))).toBe(false);
    expect(existsSync(join(out, 'src/harness.ts'))).toBe(false);
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
