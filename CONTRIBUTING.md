# Contributing

Roc is built from source SVGs and a single Node.js build script. This guide covers the human workflow for changing icons, generated assets, and documentation.

For the detailed icon design rules, examples, and style constraints, use [`CLAUDE.md`](CLAUDE.md).

## Prerequisites

- Node.js 22+
- npm

## Local Setup

```bash
npm install
npm run build
```

`npm run build` runs the full pipeline:

1. Optimize `src/svg/**/*.svg`
2. Generate React output in `dist/react/`
3. Generate Svelte output in `dist/svelte/`
4. Generate `dist/sprite.svg`
5. Generate `dist/metadata.json`
6. Regenerate `demo/index.html`

## Repo Layout

- [`src/svg/`](src/svg) is the source of truth for icon artwork
- [`src/icons.json`](src/icons.json) stores labels, descriptions, categories, and tags
- [`build.mjs`](build.mjs) generates the package outputs
- [`dist/`](dist) contains generated package assets
- [`demo/src/`](demo/src) contains the gallery source files

## Add or Update an Icon

1. Create or edit the four source SVGs in:
   `src/svg/outline/{icon}.svg`
   `src/svg/solid/{icon}.svg`
   `src/svg/duotone/{icon}.svg`
   `src/svg/sharp/{icon}.svg`
2. Add or update the icon entry in [`src/icons.json`](src/icons.json).
3. Run `npm run build`.
4. Open the gallery with `npm run preview`.
5. Run `npm run check:types`.

If you are only changing docs, skip the icon steps but still run the checks that cover your change.

## Development Commands

```bash
npm run dev
npm run build
npm run build:svg
npm run build:react
npm run build:svelte
npm run build:sprite
npm run build:demo
npm run check:types
```

Notes:

- `npm run dev` watches `src/svg/`, `src/icons.json`, and `demo/src/`
- `npm run build:react`, `npm run build:svelte`, and `npm run build:sprite` re-run SVG optimization first
- `npm run verify:package` is currently an alias for `npm run check:types`

## Generated Files

The repo keeps generated artifacts checked in. When you change source SVGs, metadata, or the build pipeline, include the updated generated files in your PR:

- [`dist/`](dist)
- [`demo/index.html`](demo/index.html)

Do not hand-edit generated files unless you are fixing the generator itself.

## Pull Requests

- Keep PRs scoped to one change set when possible
- Mention any new icon names and categories in the PR description
- Include screenshots if you changed the gallery or icon appearance
- Call out build or packaging changes explicitly
- Run `npm run build` and `npm run check:types` before asking for review
