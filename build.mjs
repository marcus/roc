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

function loadOntology() {
  const ontPath = path.join('src', 'icons.json');
  if (!fs.existsSync(ontPath)) {
    console.warn('  ⚠ src/icons.json not found – using empty ontology');
    return { categories: [], icons: {} };
  }
  const ont = JSON.parse(fs.readFileSync(ontPath, 'utf-8'));
  // Validate categories
  const validCats = new Set(ont.categories || []);
  for (const [name, meta] of Object.entries(ont.icons || {})) {
    if (meta.category && !validCats.has(meta.category)) {
      console.warn(`  ⚠ icon "${name}" has unknown category "${meta.category}"`);
    }
  }
  return ont;
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
    try {
      const { data: optimizedSvg } = optimize(raw, svgoConfig);
      const innerSvg = getSvgInner(optimizedSvg);
      const outDir   = path.join(DIST_DIR, 'svg', style);
      ensureDir(outDir);
      fs.writeFileSync(path.join(outDir, `${name}.svg`), optimizedSvg);
      manifest.push({ style, name, optimizedSvg, innerSvg });
    } catch (err) {
      console.warn(`  ⚠ skipping ${style}/${name}.svg: ${err.reason || err.message}`);
    }
  }

  console.log(`  ✓ ${manifest.length} SVGs optimized → ${DIST_DIR}/svg/`);
  return manifest;
}

// ── Stage 5 — Metadata JSON ─────────────────────────────────────────
function stageMetadata(manifest, ontology) {
  console.log('Stage 5: generating metadata...');
  const byName = new Map();
  for (const { name, style } of manifest) {
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(style);
  }

  const metadata = {
    icons: [...byName.entries()]
      .map(([name, styles]) => {
        const meta = (ontology.icons || {})[name] || {};
        return {
          name,
          label: meta.label || name.charAt(0).toUpperCase() + name.slice(1),
          description: meta.description || '',
          category: meta.category || 'Uncategorized',
          tags: meta.tags || [],
          styles,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    categories: ontology.categories || [],
    totalCount: manifest.length,
    styles: STYLES,
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
  let { size = 24, ...rest } = $props();
  let sw = $derived(size <= 16 ? 1.75 : 1.5);
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
  ${svgInner}
</svg>
`;
    } else {
      component = `<script>
  let { size = 24, ...rest } = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
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
function stageDemo(manifest, ontology) {
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

  // Build icon metadata from ontology
  const ICON_META = {};
  for (const name of iconNames) {
    const meta = (ontology.icons || {})[name] || {};
    ICON_META[name] = {
      label: meta.label || name.charAt(0).toUpperCase() + name.slice(1),
      description: meta.description || '',
      category: meta.category || 'Uncategorized',
      tags: meta.tags || [],
    };
  }

  const rocInnerSvg = iconsObj.duotone?.roc || iconsObj.outline?.roc || '';
  const searchInnerSvg = iconsObj.outline?.search || '';
  const moonInnerSvg = iconsObj.outline?.moon || '';
  const sunInnerSvg = iconsObj.outline?.sun || '';

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Roc — Icon Library</title>

<link rel="canonical" href="https://haplab.com/roc/" />

<meta property="og:type" content="website" />
<meta property="og:url" content="https://haplab.com/roc/" />
<meta property="og:title" content="Roc — ${iconNames.length} icons, 4 styles" />
<meta property="og:description" content="Hand-crafted SVG icons in outline, solid, duotone, and sharp variants. Built for React and Svelte." />
<meta property="og:image" content="https://haplab.com/roc/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://haplab.com/roc/og-image.png" />
<meta name="twitter:image:alt" content="Roc icon library — ${iconNames.length} icons shown in outline, solid, duotone, and sharp styles on a dark background" />
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

    --color-accent-default: #e8b931;
    --color-accent-hover: #f0c84a;
    --color-accent-subtle: rgba(232, 185, 49, 0.10);

    --color-success: #4ade80;
    --color-warning: #e5a63e;
    --color-error: #ef5555;
    --color-info: #58a6ff;

    --color-duotone-fill: rgba(94, 106, 210, 0.15);
    --color-icon-primary: #ededef;
    --color-icon-secondary: #8b8b90;
    --color-icon-accent: #e8b931;
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

    --color-accent-default: #b8941a;
    --color-accent-hover: #9a7c14;
    --color-accent-subtle: rgba(184, 148, 26, 0.08);

    --color-success: #22a355;
    --color-warning: #c4880c;
    --color-error: #dc3131;
    --color-info: #2b7de9;

    --color-duotone-fill: rgba(94, 106, 210, 0.10);
    --color-icon-primary: #1a1a1e;
    --color-icon-secondary: #6b6b73;
    --color-icon-accent: #b8941a;
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
  .page-header-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .logo-mark {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }
  .logo-mark::before {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: var(--radius-full);
    background: radial-gradient(circle, var(--color-accent-subtle) 0%, transparent 70%);
    opacity: 0.8;
  }
  .logo-mark svg {
    position: relative;
    color: var(--color-accent-default);
  }
  .logo-text {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .logo-text h1 {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    letter-spacing: -0.03em;
    line-height: 1.2;
  }
  .logo-subtitle {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
    font-weight: var(--font-medium);
    line-height: 1.2;
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
    gap: 2px;
  }
  .theme-toggle button {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    cursor: pointer;
    transition: all var(--duration-fast);
    color: var(--color-text-tertiary);
    border: 1px solid transparent;
  }
  .theme-toggle button:hover { color: var(--color-text-primary); }
  .theme-toggle button.active {
    color: var(--color-accent-default);
    border-color: var(--color-accent-default);
  }
  .theme-toggle button svg { width: 16px; height: 16px; }

  .github-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    color: var(--color-text-tertiary);
    transition: color var(--duration-fast);
    flex-shrink: 0;
  }
  .github-link:hover { color: var(--color-text-primary); }
  .github-link svg { width: 18px; height: 18px; }

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
    background: transparent;
    padding: 1px var(--space-2);
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
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    padding: var(--space-4) var(--space-6);
  }

  .icon-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-4) var(--space-2) var(--space-3);
    cursor: pointer;
    transition: background var(--duration-fast);
    position: relative;
  }
  .icon-cell:hover { background: var(--color-bg-hover); }
  .icon-cell .icon-name {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
    font-weight: var(--font-medium);
    margin-top: var(--space-2);
    text-align: center;
    line-height: 1.3;
    word-break: break-word;
  }

  .copy-btn {
    all: unset;
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    color: var(--color-text-tertiary);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-default);
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--duration-fast);
  }
  .icon-cell:hover .copy-btn { opacity: 1; }
  .copy-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-hover);
  }

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-icon-primary);
    padding: var(--space-2);
  }
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
    cursor: pointer;
    color: var(--color-text-tertiary);
    transition: all var(--duration-fast);
    font-variant-numeric: tabular-nums;
    border: 1px solid transparent;
  }
  .size-btn:hover { color: var(--color-text-primary); }
  .size-btn.active {
    color: var(--color-accent-default);
    border-color: var(--color-accent-default);
  }

  /* ── View toggle ───────────────────────── */
  .view-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }
  .view-toggle label {
    font-weight: var(--font-medium);
    color: var(--color-text-tertiary);
  }
  .view-btn {
    all: unset;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    cursor: pointer;
    color: var(--color-text-tertiary);
    transition: all var(--duration-fast);
    border: 1px solid transparent;
  }
  .view-btn:hover { color: var(--color-text-primary); }
  .view-btn.active {
    color: var(--color-accent-default);
    border-color: var(--color-accent-default);
  }

  /* ── Category view ─────────────────────── */
  .cat-section-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-6);
    border-bottom: 1px solid var(--color-border-subtle);
    background: var(--color-bg-secondary);
  }
  .cat-section-label {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    letter-spacing: -0.01em;
  }
  .cat-section-count {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
  }
  .cat-icon-row {
    display: flex;
    align-items: center;
    padding: var(--space-3) var(--space-6);
    border-bottom: 1px solid var(--color-border-subtle);
    gap: var(--space-4);
    cursor: pointer;
    transition: background var(--duration-fast);
  }
  .cat-icon-row:hover { background: var(--color-bg-hover); }

  .count-bar {
    display: flex;
    align-items: center;
    padding: var(--space-2) var(--space-6);
    border-bottom: 1px solid var(--color-border-subtle);
    background: var(--color-bg-primary);
  }
  .icon-count {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
    font-variant-numeric: tabular-nums;
  }
  .cat-icon-name {
    min-width: 100px;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
  }
  .cat-icon-variants {
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }
  .cat-icon-variant {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .cat-icon-variant .variant-label {
    font-size: 10px;
    color: var(--color-text-tertiary);
  }

  /* ── Search bar ────────────────────────── */
  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
  }
  .search-bar svg {
    position: absolute;
    left: 8px;
    width: 14px;
    height: 14px;
    color: var(--color-text-tertiary);
    pointer-events: none;
  }
  .search-input {
    all: unset;
    width: 180px;
    height: 28px;
    padding: 0 var(--space-2) 0 28px;
    font-size: var(--text-xs);
    font-family: inherit;
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-default);
    transition: border-color var(--duration-fast);
  }
  .search-input::placeholder { color: var(--color-text-tertiary); }
  .search-input:focus { border-color: var(--color-accent-default); outline: none; }

  /* ── Category filter bar ───────────────── */
  .category-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-6);
    border-bottom: 1px solid var(--color-border-strong);
    background: var(--color-bg-secondary);
  }
  .cat-btn {
    all: unset;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    cursor: pointer;
    color: var(--color-text-tertiary);
    transition: all var(--duration-fast);
    border: 1px solid transparent;
  }
  .cat-btn:hover { color: var(--color-text-primary); }
  .cat-btn.active {
    color: var(--color-accent-default);
    border-color: var(--color-accent-default);
  }

  /* ── Empty state ───────────────────────── */
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-12) var(--space-6);
    color: var(--color-text-tertiary);
    font-size: var(--text-sm);
  }

  /* ── Detail side panel ────────────────── */
  .detail-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 200;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-normal) ease;
  }
  .detail-backdrop.open {
    opacity: 1;
    pointer-events: auto;
  }
  .detail-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 480px;
    max-width: 90vw;
    background: var(--color-bg-secondary);
    border-left: 1px solid var(--color-border-strong);
    z-index: 201;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: -8px 0 24px rgba(0,0,0,0.15);
  }
  .detail-panel.open {
    transform: translateX(0);
  }
  .detail-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border-strong);
    flex-shrink: 0;
  }
  .detail-panel-header-left {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }
  .detail-title {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    white-space: nowrap;
  }
  .detail-filename {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail-close {
    all: unset;
    cursor: pointer;
    color: var(--color-text-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    transition: all var(--duration-fast);
  }
  .detail-close:hover { color: var(--color-text-primary); background: var(--color-bg-tertiary); }
  .detail-panel-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-5);
  }
  .detail-desc {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-4);
    line-height: 1.5;
  }
  .detail-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-5);
  }
  .detail-category {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-accent-default);
    padding: 2px var(--space-2);
    border: 1px solid var(--color-accent-default);
  }
  .detail-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .detail-tag {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
    padding: 1px var(--space-2);
    border: 1px solid var(--color-border-default);
  }
  .detail-section-label {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: var(--space-3);
  }
  .detail-variants {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1px;
    border: 1px solid var(--color-border-default);
    background: var(--color-border-default);
  }
  .detail-variant {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-5) var(--space-4);
    background: var(--color-bg-primary);
    position: relative;
  }
  .detail-variant-label {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-tertiary);
  }
  .detail-copy-btn {
    all: unset;
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    color: var(--color-text-tertiary);
    cursor: pointer;
    opacity: 0;
    transition: all var(--duration-fast);
  }
  .detail-variant:hover .detail-copy-btn { opacity: 1; }
  .detail-copy-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
  }
  .detail-sizes {
    display: flex;
    align-items: flex-end;
    gap: var(--space-5);
    padding: var(--space-5);
    border: 1px solid var(--color-border-default);
    background: var(--color-bg-primary);
  }
  .detail-size-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-icon-primary);
  }
  .detail-size-label {
    font-size: 10px;
    color: var(--color-text-tertiary);
    font-variant-numeric: tabular-nums;
  }

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

  /* ── Header dividers ───────────────────── */
  .header-divider {
    width: 1px;
    height: 20px;
    background: var(--color-border-default);
    flex-shrink: 0;
  }

  /* ── Responsive: mobile ─────────────────── */
  @media (max-width: 640px) {
    /* Header: two-row layout */
    .page-header {
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
    }

    /* Logo row stays compact */
    .page-header-left {
      flex: 1 1 auto;
      min-width: 0;
    }

    /* Controls row drops below the logo */
    .header-controls {
      flex: 0 0 100%;
      flex-wrap: wrap;
      gap: var(--space-2);
      align-items: center;
    }

    /* Search bar spans full width first */
    .search-bar {
      flex: 0 0 100%;
      order: -1;
    }

    .search-input {
      width: 100%;
      height: 36px;
      /* 16px prevents iOS auto-zoom on focus */
      font-size: 16px;
    }

    /* Hide vertical dividers — wastes space on mobile */
    .header-divider { display: none; }

    /* Hide keyboard shortcut hint on mobile */
    .header-kbd { display: none; }

    /* Theme toggle right-aligned on the second line */
    .theme-toggle { margin-left: auto; }
    .theme-toggle button {
      width: 36px;
      height: 36px;
    }

    /* Larger touch targets for view/size buttons */
    .view-btn,
    .size-btn {
      min-height: 36px;
      padding: var(--space-2) var(--space-3);
      display: inline-flex;
      align-items: center;
    }

    /* Footer simplify */
    .page-footer {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }
  }

  /* ── Category filter bar: always scrollable ── */
  /* (kicks in at any size to prevent overflow)  */
  .category-bar {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;        /* Firefox */
  }
  .category-bar::-webkit-scrollbar { display: none; } /* WebKit */

  /* Touch-friendly category buttons */
  @media (max-width: 640px) {
    .cat-btn {
      white-space: nowrap;
      flex-shrink: 0;
      min-height: 36px;
      padding: var(--space-2) var(--space-3);
      display: inline-flex;
      align-items: center;
    }

    /* Slightly reduce grid min cell size so more icons fit on screen */
    .icon-grid {
      grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
      padding: var(--space-3) var(--space-4);
    }

    /* Count bar padding */
    .count-bar {
      padding: var(--space-2) var(--space-4);
    }
  }
</style>
</head>
<body>

<!-- header -->
<header class="page-header">
  <div class="page-header-left">
    <div class="logo-mark">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${rocInnerSvg}</svg>
    </div>
    <div class="logo-text">
      <h1>Roc</h1>
      <span class="logo-subtitle">Open-source icon toolkit</span>
    </div>
  </div>
  <div class="header-controls">
    <div class="search-bar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${searchInnerSvg}</svg>
      <input class="search-input" id="search" type="text" placeholder="Search icons..." autocomplete="off">
    </div>
    <div class="header-divider" aria-hidden="true"></div>
    <div class="view-toggle">
      <label>View</label>
      <button class="view-btn active" data-view-mode="style" onclick="setViewMode('style')">By Style</button>
      <button class="view-btn" data-view-mode="category" onclick="setViewMode('category')">By Category</button>
    </div>
    <div class="header-divider" aria-hidden="true"></div>
    <div class="size-selector">
      <label>Size</label>
      <button class="size-btn" data-view="all" onclick="setView('all')">All</button>
      <button class="size-btn" data-view="16" onclick="setView('16')">16</button>
      <button class="size-btn" data-view="20" onclick="setView('20')">20</button>
      <button class="size-btn active" data-view="24" onclick="setView('24')">24</button>
      <button class="size-btn" data-view="32" onclick="setView('32')">32</button>
      <button class="size-btn" data-view="48" onclick="setView('48')">48</button>
    </div>
    <div class="header-divider" aria-hidden="true"></div>
    <div class="theme-toggle">
      <button id="btn-dark" class="active" onclick="setTheme('dark')" aria-label="Dark mode">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">${moonInnerSvg}</svg>
      </button>
      <button id="btn-light" onclick="setTheme('light')" aria-label="Light mode">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">${sunInnerSvg}</svg>
      </button>
    </div>
    <span class="kbd header-kbd" title="Toggle theme">T</span>
    <div class="header-divider" aria-hidden="true"></div>
    <a href="https://github.com/marcus/roc" class="github-link" target="_blank" rel="noopener noreferrer" aria-label="View on GitHub" title="View on GitHub">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5C6.75 2.5 2.5 6.75 2.5 12c0 4.2 2.72 7.75 6.5 9 .47.09.65-.2.65-.46 0-.23-.01-.98-.01-1.78-2.65.58-3.2-1.13-3.2-1.13-.43-1.1-1.06-1.39-1.06-1.39-.87-.59.07-.58.07-.58.96.07 1.46.98 1.46.98.85 1.46 2.23 1.04 2.78.79.09-.62.33-1.04.6-1.28-2.12-.24-4.35-1.06-4.35-4.72 0-1.04.37-1.9.98-2.56-.1-.24-.43-1.21.09-2.53 0 0 .8-.26 2.63.98a9.14 9.14 0 0 1 4.8 0c1.83-1.24 2.63-.98 2.63-.98.52 1.32.19 2.29.1 2.53.61.67.98 1.52.98 2.56 0 3.67-2.24 4.48-4.37 4.71.34.3.65.88.65 1.77 0 1.28-.01 2.31-.01 2.63 0 .26.17.56.66.46 3.78-1.26 6.5-4.81 6.5-9 0-5.25-4.25-9.5-9.5-9.5Z"/></svg>
    </a>
  </div>
</header>

<!-- category bar -->
<div class="category-bar" id="category-bar">
  <button class="cat-btn active" data-cat="" onclick="setCat('')">All</button>
  ${(ontology.categories || []).map(c => `<button class="cat-btn" data-cat="${c}" onclick="setCat('${c}')">${c}</button>`).join('\n  ')}
</div>

<!-- count bar -->
<div class="count-bar" id="count-bar">
  <span class="icon-count" id="icon-count"></span>
</div>

<!-- content -->
<main class="page-content" id="content"></main>

<div class="toast" id="toast">SVG copied</div>

<div class="detail-backdrop" id="detail-backdrop"></div>
<div class="detail-panel" id="detail-panel"></div>

<!-- footer -->
<footer class="page-footer">
  <div class="footer-stats">
    <span class="footer-stat"><span class="footer-dot"></span> <span id="footer-count">${iconNames.length} icons</span></span>
    <span class="footer-stat">${STYLES.length} styles</span>
    <span class="footer-stat">5 sizes</span>
  </div>
  <span>Press <span class="kbd">/</span> to search · <span class="kbd">T</span> toggle theme</span>
</footer>

<script>
// ─── Icon data (optimized SVG inner content) ─────────────────────────
const ICONS = ${JSON.stringify(iconsObj, null, 2)};

const STROKED_STYLES = new Set(${JSON.stringify([...STROKED_STYLES])});

const STYLE_META = ${JSON.stringify(STYLE_META, null, 2)};

const ICON_META = ${JSON.stringify(ICON_META, null, 2)};
const CATEGORIES = ${JSON.stringify(ontology.categories || [])};

const STYLE_ORDER = ${JSON.stringify(STYLES)};
const ICON_NAMES = ${JSON.stringify(iconNames)};
const SIZES = [16, 20, 24, 32, 48];

let searchQuery = '';
let activeCategory = '';
let viewMode = 'style';

// ── URL sync ──────────────────────────────────────────────────
var activeIcon = '';

function readURL() {
  var p = new URLSearchParams(window.location.search);
  if (p.has('q')) searchQuery = p.get('q');
  if (p.has('category')) activeCategory = p.get('category');
  if (p.has('size')) currentView = p.get('size');
  if (p.has('view')) viewMode = p.get('view');
  if (p.has('icon')) activeIcon = p.get('icon');
}

function buildURL() {
  var p = new URLSearchParams();
  if (searchQuery) p.set('q', searchQuery);
  if (activeCategory) p.set('category', activeCategory);
  if (currentView !== '24') p.set('size', currentView);
  if (viewMode !== 'style') p.set('view', viewMode);
  if (activeIcon) p.set('icon', activeIcon);
  var qs = p.toString();
  return window.location.pathname + (qs ? '?' + qs : '');
}

function syncURL() {
  history.replaceState(null, '', buildURL());
}

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

function matchesSearch(name, query) {
  if (!query) return true;
  var q = query.toLowerCase();
  var m = ICON_META[name];
  if (name.includes(q)) return true;
  if (m.label.toLowerCase().includes(q)) return true;
  if (m.description.toLowerCase().includes(q)) return true;
  return m.tags.some(function(t) { return t.toLowerCase().includes(q); });
}

function matchesCategory(name, cat) {
  if (!cat) return true;
  return ICON_META[name].category === cat;
}

function getFilteredNames() {
  return ICON_NAMES.filter(function(n) {
    return matchesSearch(n, searchQuery) && matchesCategory(n, activeCategory);
  });
}

function render() {
  var content = document.getElementById('content');
  var isSingle = currentView !== 'all';
  var sizes = isSingle ? [parseInt(currentView)] : SIZES;
  var filteredNames = getFilteredNames();

  var html = '';

  if (filteredNames.length === 0) {
    html = '<div class="empty-state">No icons match your search</div>';
  } else if (viewMode === 'category') {
    // Group filtered icons by category
    for (var ci = 0; ci < CATEGORIES.length; ci++) {
      var cat = CATEGORIES[ci];
      var catIcons = filteredNames.filter(function(n) { return ICON_META[n].category === cat; });
      if (catIcons.length === 0) continue;

      html += '<section class="style-section">';
      html += '<div class="cat-section-header">';
      html += '<span class="cat-section-label">' + cat + '</span>';
      html += '<span class="cat-section-count">' + catIcons.length + (catIcons.length === 1 ? ' icon' : ' icons') + '</span>';
      html += '</div>';

      for (var i = 0; i < catIcons.length; i++) {
        var iconName = catIcons[i];
        var label = ICON_META[iconName].label;
        html += '<div class="cat-icon-row" data-icon-name="' + iconName + '">';
        html += '<span class="cat-icon-name">' + label + '</span>';
        html += '<div class="cat-icon-variants">';
        for (var si = 0; si < STYLE_ORDER.length; si++) {
          var styleKey = STYLE_ORDER[si];
          var innerSvg = ICONS[styleKey] && ICONS[styleKey][iconName];
          if (!innerSvg) continue;
          var sz = isSingle ? parseInt(currentView) : 24;
          html += '<div class="cat-icon-variant">';
          html += '<div class="icon-wrap">' + svgWrap(sz, innerSvg, styleKey) + '</div>';
          html += '<span class="variant-label">' + STYLE_META[styleKey].label + '</span>';
          html += '</div>';
        }
        html += '</div></div>';
      }
      html += '</section>';
    }
  } else {
    // "By style" rendering — vertical wrapping grid
    var sz = isSingle ? parseInt(currentView) : 24;
    for (var si = 0; si < STYLE_ORDER.length; si++) {
      var styleKey = STYLE_ORDER[si];
      var icons = ICONS[styleKey];
      if (!icons) continue;
      var meta = STYLE_META[styleKey] || { label: styleKey, tag: '', desc: '' };

      html += '<section class="style-section">';
      html += '<div class="style-header">';
      html += '<span class="style-label">' + meta.label + '</span>';
      html += '<span class="style-tag">' + meta.tag + '</span>';
      html += '<span class="style-desc">' + meta.desc + '</span>';
      html += '</div>';
      html += '<div class="icon-grid">';

      for (var i = 0; i < filteredNames.length; i++) {
        var iconName = filteredNames[i];
        var innerSvg = icons[iconName];
        if (!innerSvg) continue;
        var label = ICON_META[iconName].label;
        html += '<div class="icon-cell" data-icon-name="' + iconName + '">';
        html += '<div class="icon-wrap">' + svgWrap(sz, innerSvg, styleKey) + '</div>';
        html += '<span class="icon-name">' + label + '</span>';
        html += '<button class="copy-btn" data-icon="' + iconName + '" data-style="' + styleKey + '" data-sz="' + sz + '" title="Copy SVG">';
        html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
        html += '</button>';
        html += '</div>';
      }
      html += '</div></section>';
    }
  }

  content.innerHTML = html;
  updateFooter(filteredNames.length);
}

function updateFooter(shown) {
  var el = document.getElementById('footer-count');
  var countEl = document.getElementById('icon-count');
  var text = shown < ICON_NAMES.length ? shown + ' of ' + ICON_NAMES.length + ' icons' : ICON_NAMES.length + ' icons';
  if (el) el.textContent = text;
  if (countEl) countEl.textContent = text;
}

function setView(v) {
  currentView = v;
  document.querySelectorAll('.size-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.view === v);
  });
  syncURL();
  render();
}

function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('btn-dark').classList.toggle('active', t === 'dark');
  document.getElementById('btn-light').classList.toggle('active', t === 'light');
}

function setCat(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
  syncURL();
  render();
}

function setViewMode(mode) {
  viewMode = mode;
  document.querySelectorAll('.view-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.viewMode === mode);
  });
  // Hide category pills when in category view (redundant)
  var catBar = document.getElementById('category-bar');
  if (catBar) {
    catBar.style.display = mode === 'category' ? 'none' : '';
  }
  if (mode === 'category') {
    activeCategory = '';
    document.querySelectorAll('.cat-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.cat === '');
    });
  }
  syncURL();
  render();
}

function openDetail(iconName) {
  var m = ICON_META[iconName];
  var isSingle = currentView !== 'all';
  var sz = isSingle ? parseInt(currentView) : 24;
  var copySvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';

  var html = '<div class="detail-panel-header">';
  html += '<div class="detail-panel-header-left">';
  html += '<span class="detail-title">' + m.label + '</span>';
  html += '<span class="detail-filename">' + iconName + '.svg</span>';
  html += '</div>';
  html += '<button class="detail-close" id="detail-close-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
  html += '</div>';
  html += '<div class="detail-panel-body">';
  html += '<div class="detail-desc">' + m.description + '</div>';
  html += '<div class="detail-meta">';
  html += '<span class="detail-category">' + m.category + '</span>';
  html += '<div class="detail-tags">';
  for (var i = 0; i < m.tags.length; i++) {
    html += '<span class="detail-tag">' + m.tags[i] + '</span>';
  }
  html += '</div></div>';
  html += '<div class="detail-section-label">Variants</div>';
  html += '<div class="detail-variants">';
  for (var si = 0; si < STYLE_ORDER.length; si++) {
    var styleKey = STYLE_ORDER[si];
    var innerSvg = ICONS[styleKey] && ICONS[styleKey][iconName];
    if (!innerSvg) continue;
    html += '<div class="detail-variant">';
    html += '<div class="icon-wrap">' + svgWrap(sz, innerSvg, styleKey) + '</div>';
    html += '<span class="detail-variant-label">' + STYLE_META[styleKey].label + '</span>';
    html += '<button class="detail-copy-btn" data-icon="' + iconName + '" data-style="' + styleKey + '" data-sz="' + sz + '">' + copySvg + '</button>';
    html += '</div>';
  }
  html += '</div>';
  // Size variations
  html += '<div class="detail-section-label" style="margin-top:var(--space-5)">Sizes</div>';
  html += '<div class="detail-sizes">';
  var sizeList = [16, 20, 24, 32, 48];
  var previewStyle = 'outline';
  var previewSvg = ICONS[previewStyle] && ICONS[previewStyle][iconName];
  if (previewSvg) {
    for (var si2 = 0; si2 < sizeList.length; si2++) {
      var s = sizeList[si2];
      html += '<div class="detail-size-item">';
      html += svgWrap(s, previewSvg, previewStyle);
      html += '<span class="detail-size-label">' + s + '</span>';
      html += '</div>';
    }
  }
  html += '</div>';
  html += '</div>';

  document.getElementById('detail-panel').innerHTML = html;
  document.getElementById('detail-panel').classList.add('open');
  document.getElementById('detail-backdrop').classList.add('open');
  activeIcon = iconName;
  history.pushState(null, '', buildURL());
}

function closeDetail() {
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('detail-backdrop').classList.remove('open');
  activeIcon = '';
  history.pushState(null, '', buildURL());
}

function copyVariant(iconName, styleKey, sz) {
  var innerSvg = ICONS[styleKey] && ICONS[styleKey][iconName];
  if (!innerSvg) return;
  var svgString = svgWrap(sz, innerSvg, styleKey);
  navigator.clipboard.writeText(svgString).then(function() {
    var toast = document.getElementById('toast');
    toast.textContent = STYLE_META[styleKey].label + ' SVG copied';
    toast.classList.add('visible');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function() { toast.classList.remove('visible'); }, 1500);
  });
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  var inSearch = document.activeElement === document.getElementById('search');

  if (e.key === 'Escape') {
    var panel = document.getElementById('detail-panel');
    if (panel && panel.classList.contains('open')) {
      closeDetail();
      return;
    }
  }

  if (e.key === '/' && !inSearch) {
    e.preventDefault();
    document.getElementById('search').focus();
    return;
  }
  if (e.key === 'Escape' && inSearch) {
    document.getElementById('search').value = '';
    searchQuery = '';
    document.getElementById('search').blur();
    syncURL();
    render();
    return;
  }
  if (e.key === 'Escape' && activeCategory) {
    setCat('');
    return;
  }

  if (inSearch) return;

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

// Click handler — detail panel, copy buttons
document.addEventListener('click', function(e) {
  // Detail panel copy button
  var copyBtn = e.target.closest('.detail-copy-btn');
  if (copyBtn) {
    copyVariant(copyBtn.dataset.icon, copyBtn.dataset.style, parseInt(copyBtn.dataset.sz));
    return;
  }

  // Grid copy button (hover overlay)
  var gridCopyBtn = e.target.closest('.copy-btn');
  if (gridCopyBtn) {
    e.stopPropagation();
    copyVariant(gridCopyBtn.dataset.icon, gridCopyBtn.dataset.style, parseInt(gridCopyBtn.dataset.sz));
    return;
  }

  // Close detail panel on backdrop click or close button
  if (e.target.id === 'detail-backdrop' || e.target.id === 'detail-close-btn') {
    closeDetail();
    return;
  }

  // Open detail on icon cell or row click
  var cell = e.target.closest('[data-icon-name]');
  if (cell && !cell.closest('.detail-panel')) {
    openDetail(cell.dataset.iconName);
    return;
  }
});

// Initialize from URL params (if any), then render
readURL();

// Apply URL state to UI controls
document.querySelectorAll('.size-btn').forEach(function(b) {
  b.classList.toggle('active', b.dataset.view === currentView);
});
document.querySelectorAll('.cat-btn').forEach(function(b) {
  b.classList.toggle('active', b.dataset.cat === activeCategory);
});
document.querySelectorAll('.view-btn').forEach(function(b) {
  b.classList.toggle('active', b.dataset.viewMode === viewMode);
});
if (viewMode === 'category') {
  var catBar = document.getElementById('category-bar');
  if (catBar) catBar.style.display = 'none';
}
if (searchQuery) {
  document.getElementById('search').value = searchQuery;
}
render();
if (activeIcon && ICON_META[activeIcon]) {
  openDetail(activeIcon);
  // Replace the initial pushState so we don't get a double entry
  history.replaceState(null, '', buildURL());
}

window.addEventListener('popstate', function() {
  var p = new URLSearchParams(window.location.search);
  var icon = p.get('icon') || '';
  activeIcon = icon;
  if (icon && ICON_META[icon]) {
    openDetail(icon);
    // openDetail pushes state, undo that so popstate doesn't stack
    history.replaceState(null, '', buildURL());
  } else {
    closeDetail();
    history.replaceState(null, '', buildURL());
  }
});

document.getElementById('search').addEventListener('input', function(e) {
  searchQuery = e.target.value;
  syncURL();
  render();
});
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
  fs.watch(path.join('src', 'icons.json'), () => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
      console.log('\n  changed: icons.json');
      main(true);
    }, 200);
  });
}

// ── Main ─────────────────────────────────────────────────────────────
function main(rebuild = false) {
  const needsSvg = runAll || flag('--svg') || flag('--react') || flag('--svelte') || flag('--sprite') || rebuild;

  const ontology = loadOntology();

  let manifest;
  if (needsSvg) manifest = stageSvg();

  if (runAll || flag('--react'))   stageReact(manifest);
  if (runAll || flag('--svelte'))  stageSvelte(manifest);
  if (runAll || flag('--sprite'))  stageSprite(manifest);

  if (manifest) stageMetadata(manifest, ontology);

  if (runAll || flag('--demo'))    stageDemo(manifest, ontology);
}

main();
if (flag('--watch')) stageWatch();
