#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { optimize } from 'svgo';

// ── Constants ────────────────────────────────────────────────────────
const STYLES   = ['outline', 'solid', 'duotone', 'sharp'];
const SRC_DIR  = 'src/svg';
const DIST_DIR = 'dist';

// ── Argument parsing ─────────────────────────────────────────────────
const args  = new Set(process.argv.slice(2));
const flag  = (f) => args.has(f);
const runAll = ![
  '--svg', '--react', '--svelte', '--sprite', '--demo', '--watch',
].some((f) => args.has(f));

// ── Shared helpers ───────────────────────────────────────────────────
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readSvgs() {
  const icons = [];
  for (const style of STYLES) {
    const dir = path.join(SRC_DIR, style);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
      const name = path.basename(file, '.svg');
      const raw  = fs.readFileSync(path.join(dir, file), 'utf8');
      icons.push({ style, name, raw });
    }
  }
  return icons;
}

function toPascalCase(str) {
  return str.replace(/(^|-)(\w)/g, (_, _sep, c) => c.toUpperCase());
}

function getSvgInner(svgString) {
  const open  = svgString.indexOf('>') + 1;
  const close = svgString.lastIndexOf('</svg>');
  return svgString.slice(open, close).trim();
}

// ── Stage 1 — SVGO optimization ─────────────────────────────────────
function stageSvg() {
  console.log('Stage 1: optimizing SVGs with SVGO...');
  const icons    = readSvgs();
  const manifest = [];

  const svgoConfig = {
    plugins: [
      { name: 'preset-default', params: { overrides: { removeViewBox: false } } },
      'removeDimensions',
    ],
  };

  for (const { style, name, raw } of icons) {
    const { data: optimizedSvg } = optimize(raw, svgoConfig);
    const innerSvg = getSvgInner(optimizedSvg);
    const outDir   = path.join(DIST_DIR, 'svg', style);
    ensureDir(outDir);
    fs.writeFileSync(path.join(outDir, `${name}.svg`), optimizedSvg);
    manifest.push({ style, name, optimizedSvg, innerSvg });
  }

  console.log(`  ✓ ${manifest.length} SVGs optimized → ${DIST_DIR}/svg/`);
  return manifest;
}

// ── Stage 5 — Metadata JSON ─────────────────────────────────────────
function stageMetadata(manifest) {
  console.log('Stage 5: generating metadata...');
  const byName = new Map();
  for (const { name, style } of manifest) {
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(style);
  }

  const metadata = {
    icons:      [...byName.entries()]
                  .map(([name, styles]) => ({ name, styles }))
                  .sort((a, b) => a.name.localeCompare(b.name)),
    totalCount: manifest.length,
    styles:     STYLES,
  };

  ensureDir(DIST_DIR);
  fs.writeFileSync(
    path.join(DIST_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2) + '\n',
  );
  console.log(`  ✓ metadata.json (${metadata.icons.length} icons, ${metadata.totalCount} variants)`);
}

// ── Placeholder stages ───────────────────────────────────────────────
function stageReact()  { console.log('Stage 2: React components — not yet implemented'); }
function stageSvelte() { console.log('Stage 3: Svelte components — not yet implemented'); }
function stageSprite() { console.log('Stage 4: SVG sprite — not yet implemented'); }
function stageDemo()   { console.log('Stage 6: Demo page — not yet implemented'); }

// ── Watch mode ───────────────────────────────────────────────────────
function stageWatch() {
  console.log('Watching src/svg/ for changes...');
  fs.watch(SRC_DIR, { recursive: true }, (_event, filename) => {
    if (!filename?.endsWith('.svg')) return;
    console.log(`\n  changed: ${filename}`);
    main(true);
  });
}

// ── Main ─────────────────────────────────────────────────────────────
function main(rebuild = false) {
  const needsSvg = runAll || flag('--svg') || flag('--react') || flag('--svelte') || flag('--sprite') || rebuild;

  let manifest;
  if (needsSvg) manifest = stageSvg();

  if (runAll || flag('--react'))   stageReact();
  if (runAll || flag('--svelte'))  stageSvelte();
  if (runAll || flag('--sprite'))  stageSprite();

  if (manifest) stageMetadata(manifest);

  if (runAll || flag('--demo'))    stageDemo();
}

main();
if (flag('--watch')) stageWatch();
