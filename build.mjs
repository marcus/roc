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

// ── Placeholder stages ───────────────────────────────────────────────
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

  if (runAll || flag('--react'))   stageReact(manifest);
  if (runAll || flag('--svelte'))  stageSvelte(manifest);
  if (runAll || flag('--sprite'))  stageSprite();

  if (manifest) stageMetadata(manifest);

  if (runAll || flag('--demo'))    stageDemo();
}

main();
if (flag('--watch')) stageWatch();
