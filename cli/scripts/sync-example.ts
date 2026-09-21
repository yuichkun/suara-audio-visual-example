#!/usr/bin/env node
/**
 * 土台 (kit / sdk / worklets / 設定) を template から example に写す。
 * 土台を直す時は cli/templates/glsl/ の側を直して、これを実行する。
 *
 *   npm run sync:example
 */
import { cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHARED_PATHS } from './shared.ts';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const template = join(repo, 'cli', 'templates', 'glsl');
const example = join(repo, 'example');

for (const path of SHARED_PATHS) {
  rmSync(join(example, path), { recursive: true, force: true });
  cpSync(join(template, path), join(example, path), { recursive: true });
  console.log(`synced ${path}`);
}
