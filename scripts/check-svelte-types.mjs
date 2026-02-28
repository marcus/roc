#!/usr/bin/env node
/**
 * Verify that Svelte subpath exports resolve with TypeScript types.
 *
 * Steps:
 *   1. npm pack the package
 *   2. Create a temp fixture with a minimal tsconfig + check file
 *   3. Install the tarball
 *   4. Run tsc --noEmit to verify type resolution
 *   5. Clean up
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const STYLES = ['outline', 'solid', 'duotone', 'sharp'];

// ── 1. Pack ──────────────────────────────────────────────────────────
console.log('1. Packing tarball...');
const packOut = execSync('npm pack --pack-destination . 2>/dev/null', { cwd: ROOT, encoding: 'utf8' }).trim();
// npm pack may print multiple lines; the tarball filename is the last line
const tarball = packOut.split('\n').pop().trim();
const tarballPath = path.join(ROOT, tarball);
console.log(`   → ${tarball}`);

// ── 2. Temp fixture ──────────────────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'roc-type-check-'));
console.log(`2. Fixture dir: ${tmp}`);

// Read a few icon names from dist to use in the check file
const sampleIcons = fs.readdirSync(path.join(ROOT, 'dist/svelte/outline'))
  .filter(f => f.endsWith('.svelte'))
  .slice(0, 3)
  .map(f => path.basename(f, '.svelte'));

// package.json
fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
  name: 'roc-type-check-fixture',
  private: true,
  type: 'module',
}, null, 2));

// tsconfig.json -- use moduleResolution: bundler to honour package.json exports
fs.writeFileSync(path.join(tmp, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    strict: true,
    noEmit: true,
    module: 'ESNext',
    moduleResolution: 'bundler',
    target: 'ESNext',
    skipLibCheck: true,
    types: [],
  },
  include: ['check.ts'],
}, null, 2));

// check.ts -- import from each subpath and verify types
const lines = [];
for (const style of STYLES) {
  const aliases = sampleIcons.map(n => `${n} as ${n}_${style}`).join(', ');
  lines.push(`import { ${aliases} } from '@marcus/roc/svelte/${style}';`);
}
// Also test root barrel with suffixed names
const suffixed = sampleIcons.map(n => `${n}Outline`).join(', ');
lines.push(`import { ${suffixed} } from '@marcus/roc/svelte';`);
lines.push('');
// Basic type assertion: each import should be a Svelte Component
lines.push(`import type { Component } from 'svelte';`);
for (const name of sampleIcons) {
  lines.push(`const _check_${name}: Component<{ size?: number }> = ${name}Outline;`);
}
lines.push('');
fs.writeFileSync(path.join(tmp, 'check.ts'), lines.join('\n'));

// ── 3. Install ───────────────────────────────────────────────────────
console.log('3. Installing tarball + dependencies...');
execSync(`npm install "${tarballPath}" svelte typescript --save-exact 2>&1`, {
  cwd: tmp,
  encoding: 'utf8',
  stdio: 'pipe',
});
console.log('   → installed');

// ── 4. Type-check ────────────────────────────────────────────────────
console.log('4. Running tsc --noEmit...');
try {
  execSync('npx tsc --noEmit', { cwd: tmp, encoding: 'utf8', stdio: 'pipe' });
  console.log('   ✓ Type check passed');
} catch (err) {
  console.error('   ✗ Type check FAILED');
  console.error(err.stdout || err.stderr || err.message);
  cleanup();
  process.exit(1);
}

// ── 5. Clean up ──────────────────────────────────────────────────────
cleanup();
console.log('5. Done — Svelte types verified.');

function cleanup() {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  try { fs.unlinkSync(tarballPath); } catch {}
}
