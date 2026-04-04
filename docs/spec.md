# Roc Build and Documentation Spec

This document describes the current repository layout, build pipeline, published package surface, and documentation map for Roc.

## Goals

Roc is a source-first icon library:

- SVG files in `src/svg/` are the canonical icon artwork.
- `src/icons.json` provides human-facing metadata.
- `build.mjs` derives all published outputs from those two inputs plus the demo source files.

The repo maintains both consumer docs and contributor docs alongside the implementation so the published package surface and the authoring workflow stay in sync.

## Repository Layout

```text
roc/
  CLAUDE.md
  CONTRIBUTING.md
  README.md
  build.mjs
  docs/
    api.md
    spec.md
  demo/
    index.html
    src/
      app.js
      disco.js
      styles.css
  scripts/
    check-svelte-types.mjs
  src/
    icons.json
    svg/
      outline/
      solid/
      duotone/
      sharp/
```

Important distinctions:

- `src/svg/` and `src/icons.json` are the editable package inputs.
- `dist/` is generated package output and is gitignored.
- `demo/index.html` is generated from `demo/src/*` and is committed so the demo site can be deployed directly.

## Source of Truth

### SVG Sources

Each icon exists as one SVG file per style:

- `src/svg/outline/{name}.svg`
- `src/svg/solid/{name}.svg`
- `src/svg/duotone/{name}.svg`
- `src/svg/sharp/{name}.svg`

Filenames are kebab-case. Build output converts them to PascalCase component names where needed.

### Metadata

`src/icons.json` defines:

- library categories
- per-icon `label`
- per-icon `description`
- per-icon `category`
- per-icon `tags`

The metadata file is used by the generated `dist/metadata.json` and the demo page.

### Demo Sources

The demo page is assembled from:

- `demo/src/styles.css`
- `demo/src/app.js`
- `demo/src/disco.js`

`build.mjs` injects generated icon data and metadata into the final `demo/index.html`.

## Build Pipeline

`build.mjs` is the only build entrypoint. `package.json` exposes it through:

- `npm run build`
- `npm run build:svg`
- `npm run build:react`
- `npm run build:svelte`
- `npm run build:sprite`
- `npm run build:demo`
- `npm run dev`

`npm install` also runs `prepare`, which invokes the full build locally.

### Stage 1: SVG Optimization

Reads every file in `src/svg/{style}/`, optimizes it with SVGO, and writes the result to `dist/svg/{style}/`.

Artifacts produced:

- optimized SVG files
- a manifest of `{ style, name, optimizedSvg, innerSvg }` records used by later stages

### Stage 2: React Code Generation

Generates React component files into `dist/react/{style}/`.

Behavior:

- converts SVG attribute names to JSX equivalents
- uses `forwardRef`
- supports `size` on all icons
- supports `strokeWidth` on stroked styles
- generates style-barrel `index.js` files
- generates `dist/react/index.js` and `dist/react/index.d.ts`

Current packaging note:

- the root React barrel exists in `dist/react/`, but `package.json` only exports `./react/*`, not `./react`
- documentation uses `@marcus/roc/react/{style}/index.js` for React style barrels because the wildcard export maps style directories, not a dedicated `./react/{style}` file export

### Stage 3: Svelte Code Generation

Generates Svelte component files into `dist/svelte/{style}/`.

Behavior:

- uses Svelte 5 runes-style props handling in generated files
- supports `size` on all icons
- derives default stroke width for stroked styles from `size`
- generates style-barrel `index.js` and `index.d.ts` files
- generates the root `dist/svelte/index.js` and `dist/svelte/index.d.ts`

### Stage 4: Sprite Generation

Creates `dist/sprite.svg` with one `<symbol>` per icon variant.

Symbol ids use the public naming convention `{name}-{style}`.

### Stage 5: Metadata Generation

Creates `dist/metadata.json` from the SVG manifest and `src/icons.json`.

The generated JSON includes:

- `icons`
- `categories`
- `totalCount`
- `styles`

### Stage 6: Demo Generation

Creates `demo/index.html` by combining:

- generated icon data from the manifest
- generated metadata from `src/icons.json`
- static assets from `demo/src/*`

`demo/index.html` should be treated as generated output even though it is committed.

## Published Package Surface

`package.json` publishes `dist/` and exports these public surfaces:

- `./react/*`
- `./svelte`
- `./svelte/outline`
- `./svelte/solid`
- `./svelte/duotone`
- `./svelte/sharp`
- `./svelte/*`
- `./svg/*`
- `./sprite`
- `./metadata`

That yields the consumer-facing import patterns documented in [api.md](api.md):

- React style barrel files and per-icon files
- Svelte root barrel, style barrels, and per-icon files
- raw optimized SVG files
- the sprite sheet
- metadata JSON

## Documentation Map

The repo now separates docs by audience:

| File | Audience | Purpose |
| --- | --- | --- |
| `README.md` | package consumers | install, quick start, supported import paths, common usage |
| `docs/api.md` | package consumers | stable export matrix, props, artifact layout |
| `CONTRIBUTING.md` | human contributors | setup, add-an-icon workflow, verification, PR guidance |
| `CLAUDE.md` | icon authors and agents | detailed SVG design rules and naming conventions |
| `docs/spec.md` | maintainers | architecture, pipeline, and documentation structure |

## Verification Expectations

The repository currently relies on these checks:

- `npm run build` to regenerate package and demo artifacts
- `npm run check:types` to validate Svelte export resolution from a packed tarball
- `npm run preview` for manual demo inspection when visuals change

The build writes and overwrites generated files but does not clean `dist/` first. For a fully clean local verification after renames or deletions, remove `dist/` before rebuilding.
