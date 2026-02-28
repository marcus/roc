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

  // TypeScript declarations
  const tsHeader = [
    `import type { Component } from 'svelte';`,
    `import type { SVGAttributes } from 'svelte/elements';`,
    ``,
    `interface IconProps extends SVGAttributes<SVGSVGElement> {`,
    `  size?: number;`,
    `}`,
    ``,
    `type Icon = Component<IconProps>;`,
    ``,
  ].join('\n');

  // Per-style .d.ts: dist/svelte/{style}/index.d.ts
  for (const [style, entries] of styleEntries) {
    const lines = entries
      .sort((a, b) => a.pascalName.localeCompare(b.pascalName))
      .map((e) => `export declare const ${e.pascalName}: Icon;`);
    fs.writeFileSync(
      path.join(svelteDir, style, 'index.d.ts'),
      tsHeader + lines.join('\n') + '\n',
    );
  }

  // Root .d.ts: dist/svelte/index.d.ts
  const rootTsLines = allEntries
    .sort((a, b) => a.suffixedName.localeCompare(b.suffixedName))
    .map((e) => `export declare const ${e.suffixedName}: Icon;`);
  fs.writeFileSync(
    path.join(svelteDir, 'index.d.ts'),
    tsHeader + rootTsLines.join('\n') + '\n',
  );

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

  // Read external source files
  const cssContent   = fs.readFileSync('demo/src/styles.css', 'utf8');
  const appJsContent = fs.readFileSync('demo/src/app.js', 'utf8');
  const discoJsContent = fs.readFileSync('demo/src/disco.js', 'utf8');

  // Build the JS data block (these require build-time interpolation)
  const jsDataBlock = `// ─── Icon data (optimized SVG inner content) ─────────────────────────
const ICONS = ${JSON.stringify(iconsObj, null, 2)};

const STROKED_STYLES = new Set(${JSON.stringify([...STROKED_STYLES])});

const STYLE_META = ${JSON.stringify(STYLE_META, null, 2)};

const ICON_META = ${JSON.stringify(ICON_META, null, 2)};
const CATEGORIES = ${JSON.stringify(ontology.categories || [])};

const STYLE_ORDER = ${JSON.stringify(STYLES)};
const ICON_NAMES = ${JSON.stringify(iconNames)};
const SIZES = [16, 20, 24, 32, 48];`;

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
${cssContent}
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
${jsDataBlock}
${appJsContent}
</script>
<script>
${discoJsContent}
</script>
</body>
</html>
`;

  ensureDir('demo');
  fs.writeFileSync(path.join('demo', 'index.html'), html);
  console.log(`  ✓ demo/index.html (${iconNames.length} icons × ${STYLES.length} styles)`);
}

// ── Watch mode ───────────────────────────────────────────────────────
let cachedManifest = null;
let cachedOntology = null;

function stageWatch() {
  console.log('Watching src/svg/ and demo/src/ for changes...');
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
  fs.watch('demo/src', { recursive: false }, (_event, filename) => {
    if (!filename) return;
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
      console.log(`\n  changed: demo/src/${filename}`);
      if (cachedManifest && cachedOntology) {
        stageDemo(cachedManifest, cachedOntology);
      } else {
        main(true);
      }
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

  // Cache for demo-only rebuilds in watch mode
  if (manifest) cachedManifest = manifest;
  cachedOntology = ontology;
}

main();
if (flag('--watch')) stageWatch();
