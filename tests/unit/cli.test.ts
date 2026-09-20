import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '../../..');
const createCli = join(root, 'cli/create.ts');
const node = process.execPath;

function runCreate(args: string[]) {
  return spawnSync(node, ['--experimental-strip-types', createCli, ...args], {
    encoding: 'utf8',
    cwd: root,
  });
}

describe('Feature: scaffold CLI', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'suara-av-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('given create-suara-av ProbeVis --renderer glsl then suara.json has name/uuid', () => {
    const out = join(dir, 'ProbeVis');
    const r = runCreate(['ProbeVis', '--renderer', 'glsl', '--out', out]);
    expect(r.status, r.stderr + r.stdout).toBe(0);
    const manifest = JSON.parse(readFileSync(join(out, 'suara.json'), 'utf8'));
    expect(manifest.name).toBe('ProbeVis');
    expect(manifest.processorUuid).toMatch(/^[A-F0-9]{32}$/);
    expect(manifest.controllerUuid).toMatch(/^[A-F0-9]{32}$/);
    expect(manifest.processorUuid).not.toBe('BDE53452E768424AB229CA2D4A0581DD');
    expect(existsSync(join(out, 'src/shaders/scene0.frag'))).toBe(true);
    expect(existsSync(join(out, 'src/sdk/midi.ts'))).toBe(true);
  });

  it('given default renderer then glsl template (has .frag not .wgsl)', () => {
    const out = join(dir, 'DefaultVis');
    const r = runCreate(['DefaultVis', '--out', out]);
    expect(r.status, r.stderr + r.stdout).toBe(0);
    expect(existsSync(join(out, 'src/shaders/scene0.frag'))).toBe(true);
    expect(existsSync(join(out, 'src/shaders/scene0.wgsl'))).toBe(false);
  });

  it('given --bind time then scene0 does not reference iSpectrum', () => {
    const out = join(dir, 'TimeOnly');
    const r = runCreate(['TimeOnly', '--bind', 'time', '--out', out]);
    expect(r.status, r.stderr + r.stdout).toBe(0);
    const frag = readFileSync(join(out, 'src/shaders/scene0.frag'), 'utf8');
    expect(frag).not.toMatch(/iSpectrum/);
    expect(frag).toMatch(/iTime/);
  });
});
