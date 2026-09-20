#!/usr/bin/env node
/** Re-extract templates/glsl from the working plugin at repo root. */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'templates', 'glsl');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

execSync(
  [
    'rsync -a',
    '--exclude node_modules --exclude .git --exclude release --exclude dist',
    '--exclude test-results --exclude playwright-report --exclude package-lock.json',
    '--exclude tests --exclude harness.html --exclude src/harness.ts',
    '--exclude cli --exclude templates --exclude playwright.config.ts',
    '--exclude scripts --exclude vitest.config.ts',
    `${root}/ ${dest}/`,
  ].join(' '),
  { stdio: 'inherit' },
);

const pkgPath = join(dest, 'package.json');
const p = JSON.parse(readFileSync(pkgPath, 'utf8'));
for (const k of ['test:e2e', 'create', 'test', 'test:watch', 'vendor:sdk']) {
  delete p.scripts[k];
}
for (const k of ['@playwright/test', 'gunshi', 'vitest']) {
  delete p.devDependencies[k];
}
writeFileSync(pkgPath, JSON.stringify(p, null, 2) + '\n');
console.log(`extracted → ${dest}`);
