#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const HOOK_PATH = path.join(ROOT, '.githooks', 'commit-msg');

if (!fs.existsSync(HOOK_PATH)) {
  console.error(`Missing hook script: ${HOOK_PATH}`);
  process.exit(1);
}

fs.chmodSync(HOOK_PATH, 0o755);
execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: ROOT,
  stdio: 'pipe',
});

console.log('Configured repo-local git hooks: .githooks');
console.log('The commit-msg normalizer will run on future commits in this clone.');
