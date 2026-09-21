import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SHARED_PATHS } from '../../cli/scripts/shared.ts';

const root = join(fileURLToPath(import.meta.url), '../../..');
const template = join(root, 'cli/templates/glsl');
const node = process.execPath;

/** npm run 経由をまねる時は initCwd (= npm が INIT_CWD に入れる、コマンドを打った場所) を渡す。 */
function runCreate(args: string[], opts: { cwd?: string; initCwd?: string } = {}) {
  // テスト自体が npm run で動いていると INIT_CWD を継承してしまうので、一度外す
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env['INIT_CWD'];
  if (opts.initCwd) env['INIT_CWD'] = opts.initCwd;
  return spawnSync(node, ['--experimental-strip-types', join(root, 'cli/create.ts'), ...args], {
    encoding: 'utf8',
    cwd: opts.cwd ?? root,
    env,
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
    const r = runCreate([out, '--vendor', 'Yogo "Test"']);
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

  it('npm run create -- ../X は、コマンドを打った場所から見た ../X に作る', () => {
    const typedIn = join(dir, 'repo');
    mkdirSync(typedIn);
    // npm は cwd を package の root (= この repo) に変えて、打った場所を INIT_CWD に入れる
    const r = runCreate(['../FromNpm'], { cwd: root, initCwd: typedIn });
    expect(r.status, r.stderr + r.stdout).toBe(0);
    expect(existsSync(join(dir, 'FromNpm/suara.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'FromNpm/suara.json'), 'utf8')).name).toBe('FromNpm');
    expect(r.stdout).toContain('cd ../FromNpm');
  });

  it('直接実行した時は cwd から解決する', () => {
    const r = runCreate(['Direct'], { cwd: dir });
    expect(r.status, r.stderr + r.stdout).toBe(0);
    expect(existsSync(join(dir, 'Direct/suara.json'))).toBe(true);
  });

  it('既にある dir には上書きしない', () => {
    const r = runCreate([out]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/already exists/);
  });

  it('入力ミスは stack trace ではなく 1 行のエラーで返す', () => {
    for (const args of [[join(dir, 'probe-vis')], [join(dir, 'Other'), '--renderer', 'wgsl'], []]) {
      const r = runCreate(args);
      expect(r.status, args.join(' ')).not.toBe(0);
      expect(r.stderr).toMatch(/^error: /m);
      expect(r.stderr).not.toMatch(/\n\s+at /);
    }
    expect(runCreate([join(dir, 'probe-vis')]).stderr).toMatch(/PascalCase.*probe-vis/);
  });
});

describe('Feature: example は template と同じ土台の上にある', () => {
  it.each(SHARED_PATHS)('%s が template と同一 (ズレたら npm run sync:example)', (path) => {
    expect(existsSync(join(root, 'example', path)), path).toBe(true);
    const r = spawnSync('diff', ['-r', join(template, path), join(root, 'example', path)], { encoding: 'utf8' });
    expect(r.stdout + r.stderr).toBe('');
  });
});
