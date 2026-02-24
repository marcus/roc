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

// ── Stage 2 — React component codegen ────────────────────────────────
const STROKED_STYLES = new Set(['outline', 'duotone', 'sharp']);

function toJsxAttributes(innerSvg, isSolid) {
  let jsx = innerSvg;

  // Convert stroke-width: dynamic {sw} for stroked styles, literal for solid
  if (isSolid) {
    jsx = jsx.replace(/stroke-width="([^"]*)"/g, 'strokeWidth="$1"');
  } else {
    jsx = jsx.replace(/stroke-width="[^"]*"/g, 'strokeWidth={sw}');
  }

  // Convert remaining kebab-case SVG attributes to camelCase JSX
  jsx = jsx.replace(/stroke-linecap=/g,  'strokeLinecap=');
  jsx = jsx.replace(/stroke-linejoin=/g, 'strokeLinejoin=');
  jsx = jsx.replace(/stroke-miterlimit=/g, 'strokeMiterlimit=');
  jsx = jsx.replace(/fill-rule=/g,       'fillRule=');
  jsx = jsx.replace(/clip-rule=/g,       'clipRule=');

  return jsx;
}

function stageReact(manifest) {
  console.log('Stage 2: generating React components...');
  const reactDir = path.join(DIST_DIR, 'react');

  // Per-style barrel entries: style -> [{name, pascalName}]
  const styleEntries = new Map();
  // All entries for root barrel + TS declarations
  const allEntries = [];

  for (const { style, name, innerSvg } of manifest) {
    const pascalName = toPascalCase(name);
    const isSolid = style === 'solid';
    const jsxInner = toJsxAttributes(innerSvg, isSolid);

    let component;
    if (isSolid) {
      component = `import { forwardRef } from 'react';

const ${pascalName} = forwardRef(({ size = 24, className, ...props }, ref) => (
  <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
    ${jsxInner}
  </svg>
));

${pascalName}.displayName = '${pascalName}';
export default ${pascalName};
`;
    } else {
      component = `import { forwardRef } from 'react';

const ${pascalName} = forwardRef(({ size = 24, strokeWidth, className, ...props }, ref) => {
  const sw = strokeWidth ?? (size <= 16 ? 1.75 : 1.5);
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      ${jsxInner}
    </svg>
  );
});

${pascalName}.displayName = '${pascalName}';
export default ${pascalName};
`;
    }

    const styleDir = path.join(reactDir, style);
    ensureDir(styleDir);
    fs.writeFileSync(path.join(styleDir, `${pascalName}.jsx`), component);

    // Collect entries for barrels
    if (!styleEntries.has(style)) styleEntries.set(style, []);
    styleEntries.get(style).push({ name, pascalName });

    const suffixedName = pascalName + toPascalCase(style);
    allEntries.push({ style, pascalName, suffixedName });
  }

  // Per-style barrel files: dist/react/{style}/index.js
  for (const [style, entries] of styleEntries) {
    const lines = entries
      .sort((a, b) => a.pascalName.localeCompare(b.pascalName))
      .map((e) => `export { default as ${e.pascalName} } from './${e.pascalName}.jsx';`);
    fs.writeFileSync(path.join(reactDir, style, 'index.js'), lines.join('\n') + '\n');
  }

  // Root barrel: dist/react/index.js
  const rootLines = allEntries
    .sort((a, b) => a.suffixedName.localeCompare(b.suffixedName))
    .map((e) => `export { default as ${e.suffixedName} } from './${e.style}/${e.pascalName}.jsx';`);
  fs.writeFileSync(path.join(reactDir, 'index.js'), rootLines.join('\n') + '\n');

  // TypeScript declarations: dist/react/index.d.ts
  const tsLines = [
    `import { ForwardRefExoticComponent, SVGProps } from 'react';`,
    ``,
    `interface IconProps extends SVGProps<SVGSVGElement> {`,
    `  size?: number;`,
    `  strokeWidth?: number;`,
    `}`,
    ``,
    `type Icon = ForwardRefExoticComponent<IconProps>;`,
    ``,
    ...allEntries
      .sort((a, b) => a.suffixedName.localeCompare(b.suffixedName))
      .map((e) => `export declare const ${e.suffixedName}: Icon;`),
    ``,
  ];
  fs.writeFileSync(path.join(reactDir, 'index.d.ts'), tsLines.join('\n'));

  console.log(`  ✓ ${manifest.length} React components → ${reactDir}/`);
}

// ── Stage 3 — Svelte component codegen ──────────────────────────────
function stageSvelte(manifest) {
  console.log('Stage 3: generating Svelte components...');
  const svelteDir = path.join(DIST_DIR, 'svelte');

  // Per-style barrel entries: style -> [{name, pascalName}]
  const styleEntries = new Map();
  // All entries for root barrel
  const allEntries = [];

  for (const { style, name, innerSvg } of manifest) {
    const pascalName = toPascalCase(name);
    const isStroked = STROKED_STYLES.has(style);

    // For stroked styles, replace stroke-width="..." with stroke-width="{sw}"
    let svgInner = innerSvg;
    if (isStroked) {
      svgInner = svgInner.replace(/stroke-width="[^"]*"/g, 'stroke-width="{sw}"');
    }

    let component;
    if (isStroked) {
      component = `<script>
  export let size = 24;
  $: sw = size <= 16 ? 1.75 : 1.5;
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" {...$$restProps}>
  ${svgInner}
</svg>
`;
    } else {
      component = `<script>
  export let size = 24;
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" {...$$restProps}>
  ${svgInner}
</svg>
`;
    }

    const styleDir = path.join(svelteDir, style);
    ensureDir(styleDir);
    fs.writeFileSync(path.join(styleDir, `${pascalName}.svelte`), component);

    // Collect entries for barrels
    if (!styleEntries.has(style)) styleEntries.set(style, []);
    styleEntries.get(style).push({ name, pascalName });

    const suffixedName = pascalName + toPascalCase(style);
    allEntries.push({ style, pascalName, suffixedName });
  }

  // Per-style barrel files: dist/svelte/{style}/index.js
  for (const [style, entries] of styleEntries) {
    const lines = entries
      .sort((a, b) => a.pascalName.localeCompare(b.pascalName))
      .map((e) => `export { default as ${e.pascalName} } from './${e.pascalName}.svelte';`);
    fs.writeFileSync(path.join(svelteDir, style, 'index.js'), lines.join('\n') + '\n');
  }

  // Root barrel: dist/svelte/index.js
  const rootLines = allEntries
    .sort((a, b) => a.suffixedName.localeCompare(b.suffixedName))
    .map((e) => `export { default as ${e.suffixedName} } from './${e.style}/${e.pascalName}.svelte';`);
  fs.writeFileSync(path.join(svelteDir, 'index.js'), rootLines.join('\n') + '\n');

  console.log(`  ✓ ${manifest.length} Svelte components → ${svelteDir}/`);
}

// ── Stage 4 — SVG sprite ──────────────────────────────────────────────
function stageSprite(manifest) {
  console.log('Stage 4: generating SVG sprite...');

  // Build symbols sorted alphabetically by id ({name}-{style})
  const symbols = manifest
    .map(({ style, name, innerSvg }) => ({
      id: `${name}-${style}`,
      innerSvg,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const symbolsXml = symbols
    .map(
      ({ id, innerSvg }) =>
        `  <symbol id="${id}" viewBox="0 0 24 24" fill="none">\n    ${innerSvg}\n  </symbol>`,
    )
    .join('\n');

  const sprite = `<svg xmlns="http://www.w3.org/2000/svg">\n${symbolsXml}\n</svg>\n`;

  ensureDir(DIST_DIR);
  fs.writeFileSync(path.join(DIST_DIR, 'sprite.svg'), sprite);
  console.log(`  ✓ sprite.svg (${symbols.length} symbols)`);
}

// ── Stage 6 — Demo page ──────────────────────────────────────────────
function stageDemo(manifest) {
  console.log('Stage 6: generating demo page...');

  // Group icons by style, then by name
  const iconsByStyle = new Map();
  for (const { style, name, innerSvg } of manifest) {
    if (!iconsByStyle.has(style)) iconsByStyle.set(style, new Map());
    iconsByStyle.get(style).set(name, innerSvg);
  }

  // Build the ICONS data object as JS source
  const iconsObj = {};
  for (const style of STYLES) {
    if (!iconsByStyle.has(style)) continue;
    iconsObj[style] = {};
    const names = [...iconsByStyle.get(style).keys()].sort();
    for (const name of names) {
      iconsObj[style][name] = iconsByStyle.get(style).get(name);
    }
  }

  // Collect unique icon names (sorted) for rendering
  const iconNames = [...new Set(manifest.map((m) => m.name))].sort();
  const iconCount = manifest.length;

  // Style metadata for headers
  const STYLE_META = {
    outline: { label: 'Outline', tag: 'Stroke', desc: 'Clean single-weight strokes — default for navigation and toolbars' },
    solid:   { label: 'Solid',   tag: 'Filled', desc: 'Filled shapes with negative-space details — best for active/selected states' },
    duotone: { label: 'Duotone', tag: '2-Tone', desc: 'Accent fill layer + foreground stroke — ideal for feature highlights and onboarding' },
    sharp:   { label: 'Sharp',   tag: 'Geometric', desc: 'Angular cuts, squared joins, no curves — engineered density for compact UI' },
  };

  // Pretty labels for icon names
  const ICON_LABELS = {
    home: 'Home', chart: 'Analytics', users: 'Team', bell: 'Alerts', settings: 'Settings', roc: 'Roc',
  };

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Roc — Dashboard</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --space-6: 24px;
    --space-8: 32px;
    --space-10: 40px;
    --space-12: 48px;

    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-full: 9999px;

    --text-xs: 11px;
    --text-sm: 13px;
    --text-base: 14px;
    --text-lg: 16px;
    --text-xl: 20px;
    --text-2xl: 24px;

    --font-medium: 500;
    --font-semibold: 600;
    --font-bold: 700;

    --duration-fast: 150ms;
    --duration-normal: 200ms;
  }

  /* Dark theme (default) */
  [data-theme="dark"] {
    --color-bg-primary: #0a0a0b;
    --color-bg-secondary: #111113;
    --color-bg-tertiary: #191a1c;
    --color-bg-hover: #1f2023;
    --color-bg-inset: #08080a;

    --color-text-primary: #ededef;
    --color-text-secondary: #8b8b90;
    --color-text-tertiary: #5c5c63;

    --color-border-strong: #2a2a2e;
    --color-border-default: #222226;
    --color-border-subtle: #1a1a1e;

    --color-accent-default: #5e6ad2;
    --color-accent-hover: #6e7ae2;
    --color-accent-subtle: rgba(94, 106, 210, 0.12);

    --color-success: #4ade80;
    --color-warning: #e5a63e;
    --color-error: #ef5555;
    --color-info: #58a6ff;

    --color-duotone-fill: rgba(94, 106, 210, 0.15);
    --color-icon-primary: #ededef;
    --color-icon-secondary: #8b8b90;
    --color-icon-accent: #5e6ad2;
  }

  /* Light theme */
  [data-theme="light"] {
    --color-bg-primary: #ffffff;
    --color-bg-secondary: #f8f8f9;
    --color-bg-tertiary: #f0f0f2;
    --color-bg-hover: #eaeaed;
    --color-bg-inset: #f4f4f6;

    --color-text-primary: #1a1a1e;
    --color-text-secondary: #6b6b73;
    --color-text-tertiary: #9c9ca5;

    --color-border-strong: #d4d4d9;
    --color-border-default: #e2e2e6;
    --color-border-subtle: #ececef;

    --color-accent-default: #5e6ad2;
    --color-accent-hover: #4e5ac2;
    --color-accent-subtle: rgba(94, 106, 210, 0.08);

    --color-success: #22a355;
    --color-warning: #c4880c;
    --color-error: #dc3131;
    --color-info: #2b7de9;

    --color-duotone-fill: rgba(94, 106, 210, 0.10);
    --color-icon-primary: #1a1a1e;
    --color-icon-secondary: #6b6b73;
    --color-icon-accent: #5e6ad2;
  }

  html { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  body {
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  /* ── Header ─────────────────────────────── */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-6);
    border-bottom: 1px solid var(--color-border-strong);
    background: var(--color-bg-secondary);
  }
  .page-header h1 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    letter-spacing: -0.02em;
  }
  .header-controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  /* ── Theme toggle ───────────────────────── */
  .theme-toggle {
    display: flex;
    align-items: center;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-full);
    padding: 2px;
    cursor: pointer;
    gap: 0;
  }
  .theme-toggle button {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: all var(--duration-fast);
    color: var(--color-text-tertiary);
  }
  .theme-toggle button.active {
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }
  .theme-toggle button svg { width: 16px; height: 16px; }

  /* ── Main content ───────────────────────── */
  .page-content {
    display: flex;
    flex-direction: column;
  }

  /* ── Style section ──────────────────────── */
  .style-section {
    border-bottom: 1px solid var(--color-border-strong);
  }
  .style-section:last-child { border-bottom: none; }

  .style-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-6);
    border-bottom: 1px solid var(--color-border-subtle);
    background: var(--color-bg-secondary);
  }
  .style-label {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    letter-spacing: -0.01em;
  }
  .style-tag {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-tertiary);
    background: var(--color-bg-tertiary);
    padding: 1px var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-default);
  }
  .style-desc {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
    margin-left: auto;
  }

  /* ── Icon grid ──────────────────────────── */
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(${iconNames.length}, 1fr);
  }
  .icon-column {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--color-border-subtle);
  }
  .icon-column:last-child { border-right: none; }

  .icon-name-row {
    padding: var(--space-2) var(--space-4);
    text-align: center;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-tertiary);
    border-bottom: 1px solid var(--color-border-subtle);
    background: var(--color-bg-secondary);
  }

  .icon-sizes {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-6);
    padding: var(--space-6) var(--space-4);
  }

  .icon-size-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .icon-size-item .size-label {
    font-size: 10px;
    color: var(--color-text-tertiary);
    font-variant-numeric: tabular-nums;
  }

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-icon-primary);
    transition: color var(--duration-fast);
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: var(--space-2);
  }
  .icon-wrap:hover {
    color: var(--color-icon-accent);
    background: var(--color-accent-subtle);
  }
  .icon-wrap:active { transform: scale(0.92); }
  .icon-wrap svg {
    display: block;
    flex-shrink: 0;
  }

  /* ── Toast ──────────────────────────────── */
  .toast {
    position: fixed;
    bottom: var(--space-6);
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-default);
    color: var(--color-text-primary);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    opacity: 0;
    pointer-events: none;
    transition: all var(--duration-normal) ease-out;
    z-index: 100;
    white-space: nowrap;
  }
  .toast.visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  /* ── Size selector ──────────────────────── */
  .size-selector {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }
  .size-selector label {
    font-weight: var(--font-medium);
    color: var(--color-text-tertiary);
  }
  .size-btn {
    all: unset;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--color-text-tertiary);
    transition: all var(--duration-fast);
    font-variant-numeric: tabular-nums;
  }
  .size-btn:hover { color: var(--color-text-primary); background: var(--color-bg-tertiary); }
  .size-btn.active {
    background: var(--color-accent-subtle);
    color: var(--color-accent-default);
  }

  /* ── Compact single-size view ───────────── */
  .icon-grid.single-size .icon-sizes {
    padding: var(--space-5) var(--space-4);
  }
  .icon-grid.single-size .icon-sizes .icon-size-item { display: none; }
  .icon-grid.single-size .icon-sizes .icon-size-item.active-size { display: flex; }
  .icon-grid.single-size .icon-sizes .icon-size-item.active-size .size-label { display: none; }

  /* ── Keyboard hint ──────────────────────── */
  .kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 var(--space-1);
    font-size: 10px;
    font-weight: var(--font-medium);
    color: var(--color-text-tertiary);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
    font-family: 'Inter', sans-serif;
  }

  /* ── Footer ─────────────────────────────── */
  .page-footer {
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--color-border-strong);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
  }
  .footer-stats {
    display: flex;
    gap: var(--space-5);
  }
  .footer-stat {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .footer-dot {
    width: 6px; height: 6px;
    border-radius: var(--radius-full);
    background: var(--color-success);
  }
</style>
</head>
<body>

<!-- header -->
<header class="page-header">
  <h1>Roc</h1>
  <div class="header-controls">
    <div class="size-selector">
      <label>Size</label>
      <button class="size-btn" data-view="all" onclick="setView('all')">All</button>
      <button class="size-btn" data-view="16" onclick="setView('16')">16</button>
      <button class="size-btn" data-view="20" onclick="setView('20')">20</button>
      <button class="size-btn active" data-view="24" onclick="setView('24')">24</button>
      <button class="size-btn" data-view="32" onclick="setView('32')">32</button>
      <button class="size-btn" data-view="48" onclick="setView('48')">48</button>
    </div>
    <div style="width:1px;height:20px;background:var(--color-border-default)"></div>
    <div class="theme-toggle">
      <button id="btn-dark" class="active" onclick="setTheme('dark')" aria-label="Dark mode">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 8.5a5.5 5.5 0 0 1-7-7A5.5 5.5 0 1 0 13.5 8.5Z"/></svg>
      </button>
      <button id="btn-light" onclick="setTheme('light')" aria-label="Light mode">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7"/></svg>
      </button>
    </div>
    <span class="kbd" title="Toggle theme">T</span>
  </div>
</header>

<!-- content -->
<main class="page-content" id="content"></main>

<div class="toast" id="toast">SVG copied</div>

<!-- footer -->
<footer class="page-footer">
  <div class="footer-stats">
    <span class="footer-stat"><span class="footer-dot"></span> ${iconCount} icons</span>
    <span class="footer-stat">${STYLES.length} styles</span>
    <span class="footer-stat">5 sizes</span>
  </div>
  <span>Press <span class="kbd">T</span> to toggle theme</span>
</footer>

<script>
// ─── Icon data (optimized SVG inner content) ─────────────────────────
const ICONS = ${JSON.stringify(iconsObj, null, 2)};

const STROKED_STYLES = new Set(${JSON.stringify([...STROKED_STYLES])});

const STYLE_META = ${JSON.stringify(STYLE_META, null, 2)};

const ICON_LABELS = ${JSON.stringify(ICON_LABELS, null, 2)};

const STYLE_ORDER = ${JSON.stringify(STYLES)};
const ICON_NAMES = ${JSON.stringify(iconNames)};
const SIZES = [16, 20, 24, 32, 48];

// Stroke widths that look optically correct at each size
function sw(size) {
  if (size <= 16) return 1.75;
  if (size <= 20) return 1.5;
  return 1.5;
}

function svgWrap(size, innerSvg, style) {
  let content = innerSvg;
  if (STROKED_STYLES.has(style)) {
    content = content.replace(/stroke-width="[^"]*"/g, 'stroke-width="' + sw(size) + '"');
  }
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' + content + '</svg>';
}

let currentView = '24';

function render() {
  const content = document.getElementById('content');
  const isSingle = currentView !== 'all';
  const sizes = isSingle ? [parseInt(currentView)] : SIZES;

  let html = '';

  for (const styleKey of STYLE_ORDER) {
    const icons = ICONS[styleKey];
    if (!icons) continue;
    const meta = STYLE_META[styleKey] || { label: styleKey, tag: '', desc: '' };

    html += '<section class="style-section">';
    html += '<div class="style-header">';
    html += '<span class="style-label">' + meta.label + '</span>';
    html += '<span class="style-tag">' + meta.tag + '</span>';
    html += '<span class="style-desc">' + meta.desc + '</span>';
    html += '</div>';
    html += '<div class="icon-grid' + (isSingle ? ' single-size' : '') + '">';

    for (const iconName of ICON_NAMES) {
      const innerSvg = icons[iconName];
      if (!innerSvg) continue;
      const label = ICON_LABELS[iconName] || iconName;
      html += '<div class="icon-column">';
      html += '<div class="icon-name-row">' + label + '</div>';
      html += '<div class="icon-sizes">';
      for (const sz of sizes) {
        const isActive = isSingle ? ' active-size' : '';
        html += '<div class="icon-size-item' + isActive + '">';
        html += '<div class="icon-wrap">' + svgWrap(sz, innerSvg, styleKey) + '</div>';
        html += '<span class="size-label">' + sz + '</span>';
        html += '</div>';
      }
      html += '</div></div>';
    }

    html += '</div></section>';
  }

  content.innerHTML = html;
}

function setView(v) {
  currentView = v;
  document.querySelectorAll('.size-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.view === v);
  });
  render();
}

function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('btn-dark').classList.toggle('active', t === 'dark');
  document.getElementById('btn-light').classList.toggle('active', t === 'light');
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (e.key === 't' || e.key === 'T') {
    var current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  }
  if (e.key === '1') setView('16');
  if (e.key === '2') setView('20');
  if (e.key === '3') setView('24');
  if (e.key === '4') setView('32');
  if (e.key === '5') setView('48');
  if (e.key === '0') setView('all');
});

// Copy SVG on click
document.addEventListener('click', function(e) {
  var wrap = e.target.closest('.icon-wrap');
  if (!wrap) return;
  var svg = wrap.querySelector('svg');
  if (!svg) return;
  var svgString = svg.outerHTML;
  navigator.clipboard.writeText(svgString).then(function() {
    var toast = document.getElementById('toast');
    toast.textContent = 'SVG copied to clipboard';
    toast.classList.add('visible');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function() { toast.classList.remove('visible'); }, 1500);
  });
});

// Initialize — default to "all sizes" view
setView('all');
</script>
</body>
</html>
`;

  ensureDir('demo');
  fs.writeFileSync(path.join('demo', 'index.html'), html);
  console.log(`  ✓ demo/index.html (${iconNames.length} icons × ${STYLES.length} styles)`);
}

// ── Watch mode ───────────────────────────────────────────────────────
function stageWatch() {
  console.log('Watching src/svg/ for changes...');
  let watchTimer;
  fs.watch(SRC_DIR, { recursive: true }, (_event, filename) => {
    if (!filename?.endsWith('.svg')) return;
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
      console.log(`\n  changed: ${filename}`);
      main(true);
    }, 200);
  });
}

// ── Main ─────────────────────────────────────────────────────────────
function main(rebuild = false) {
  const needsSvg = runAll || flag('--svg') || flag('--react') || flag('--svelte') || flag('--sprite') || rebuild;

  let manifest;
  if (needsSvg) manifest = stageSvg();

  if (runAll || flag('--react'))   stageReact(manifest);
  if (runAll || flag('--svelte'))  stageSvelte(manifest);
  if (runAll || flag('--sprite'))  stageSprite(manifest);

  if (manifest) stageMetadata(manifest);

  if (runAll || flag('--demo'))    stageDemo(manifest);
}

main();
if (flag('--watch')) stageWatch();
