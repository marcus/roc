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
- [`scripts/icon-batches.json`](scripts/icon-batches.json) stores curated multi-icon batch groupings
- [`scripts/icon-batch-prompt.md`](scripts/icon-batch-prompt.md) is the reusable prompt template for batch authoring

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

## Batch Icon Authoring

Use batches when you are adding a themed set of icons, parallelizing work across multiple contributors or agents, or making one ontology update that applies to several icons at once. Single-icon changes can follow the normal flow above.

1. Pick a group from [`scripts/icon-batches.json`](scripts/icon-batches.json), or add a new grouping there if the current list does not fit the work. Keep batches small and thematically consistent so review stays manageable.
2. Copy [`scripts/icon-batch-prompt.md`](scripts/icon-batch-prompt.md), replace `{{ICONS}}` with the selected icon names, and give the assignee both that prompt and [`CLAUDE.md`](CLAUDE.md). The prompt covers execution details; `CLAUDE.md` remains the style-spec source of truth.
3. Update [`src/icons.json`](src/icons.json) in the same change as the SVG files. Every icon needs `label`, `description`, `category`, and `tags`. Prefer existing categories. If you intentionally introduce a new category, update the top-level `"categories"` array too.
4. Run `npm run build` after the batch lands so the generated package outputs, metadata, and gallery stay in sync.
5. Run `npm run check:types` to verify the packaged Svelte entry points still resolve with TypeScript.
6. Open the gallery with `npm run preview` and spot-check the new icons in all four styles before opening the PR.

If the batch changes source SVGs or metadata, include regenerated [`dist/`](dist) output and [`demo/index.html`](demo/index.html) in the same PR. Do not hand-edit generated files unless you are fixing the generator itself.

## Development Commands

```bash
npm run dev
npm run build
npm run build:svg
npm run build:react
npm run build:svelte
npm run build:sprite
npm run check:types
```

Notes:

- `npm run dev` watches `src/svg/`, `src/icons.json`, and `demo/src/`
- `npm run build` is the supported way to regenerate [`demo/index.html`](demo/index.html)
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
