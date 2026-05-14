#!/usr/bin/env node
/**
 * Verify that packaged React and Svelte exports resolve with TypeScript types.
 *
 * Steps:
 *   1. npm pack the package
 *   2. Create a temp fixture with minimal tsconfig + check files
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

// Read a few icon names from dist to use in the check files
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
    jsx: 'react-jsx',
    skipLibCheck: true,
    types: [],
  },
  include: ['check-react.ts', 'check-svelte.ts'],
}, null, 2));

// check-svelte.ts -- import from each subpath and verify types
const svelteLines = [];
for (const style of STYLES) {
  const aliases = sampleIcons.map(n => `${n} as ${n}_${style}`).join(', ');
  svelteLines.push(`import { ${aliases} } from '@marcus/roc/svelte/${style}';`);
}

const sampleIcon = sampleIcons[0];
const sampleStyle = STYLES[0];

// Also test root barrel with suffixed names and a direct file import.
const suffixed = sampleIcons.map(n => `${n}Outline`).join(', ');
svelteLines.push(`import { ${suffixed} } from '@marcus/roc/svelte';`);
svelteLines.push(`import ${sampleIcon}${sampleStyle}File from '@marcus/roc/svelte/${sampleStyle}/${sampleIcon}.svelte';`);
svelteLines.push('');
svelteLines.push(`import type { Component } from 'svelte';`);
for (const name of sampleIcons) {
  svelteLines.push(`const _check_${name}: Component<{ size?: number }> = ${name}Outline;`);
}
svelteLines.push(`const _fileCheck: Component<{ size?: number }> = ${sampleIcon}${sampleStyle}File;`);
svelteLines.push('');
fs.writeFileSync(path.join(tmp, 'check-svelte.ts'), svelteLines.join('\n'));

// check-react.ts -- import React entry points and direct files
const reactLines = [];
for (const style of STYLES) {
  const aliases = sampleIcons.map(n => `${n} as ${n}_${style}`).join(', ');
  reactLines.push(`import { ${aliases} } from '@marcus/roc/react/${style}';`);
}
const reactSuffixed = sampleIcons.map(n => `${n}Outline`).join(', ');
reactLines.push(`import { ${reactSuffixed} } from '@marcus/roc/react';`);
reactLines.push(`import ${sampleIcon}${sampleStyle}Jsx from '@marcus/roc/react/${sampleStyle}/${sampleIcon}.jsx';`);
reactLines.push('');
reactLines.push(`import type { ForwardRefExoticComponent, SVGProps } from 'react';`);
for (const name of sampleIcons) {
  reactLines.push(`const _react_${name}: ForwardRefExoticComponent<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }> = ${name}Outline;`);
}
reactLines.push(`const _reactFileCheck: ForwardRefExoticComponent<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }> = ${sampleIcon}${sampleStyle}Jsx;`);
reactLines.push('');
fs.writeFileSync(path.join(tmp, 'check-react.ts'), reactLines.join('\n'));

// ── 3. Install ───────────────────────────────────────────────────────
console.log('3. Installing tarball + dependencies...');
execSync(`npm install "${tarballPath}" react @types/react svelte typescript --save-exact 2>&1`, {
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
console.log('5. Done — package types verified.');

function cleanup() {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  try { fs.unlinkSync(tarballPath); } catch {}
}
