# Roc Build and Documentation Spec

This file is the internal architecture note for Roc. It describes the repo layout, generation pipeline, published exports, and the documentation split that human contributors and agents should keep in sync.

## Scope

Roc is a generated icon package built from source SVG files and icon metadata. The repo publishes consumer-facing assets for:

- React
- Svelte
- raw optimized SVG files
- a sprite sheet
- metadata JSON
- a generated demo gallery

This spec is intentionally about the current architecture. It should not describe past bootstrap steps or hypothetical package surfaces.

## Current Repo Layout

```text
roc/
├── README.md              # Consumer quick start
├── CONTRIBUTING.md        # Human contributor workflow
├── CLAUDE.md              # Detailed icon design rules
├── docs/
│   ├── api.md             # Package surface reference
│   └── spec.md            # Internal architecture note
├── src/
│   ├── icons.json         # Icon labels, descriptions, categories, tags
│   └── svg/
│       ├── outline/
│       ├── solid/
│       ├── duotone/
│       └── sharp/
├── dist/                  # Generated package artifacts
│   ├── react/
│   ├── svelte/
│   ├── svg/
│   ├── sprite.svg
│   └── metadata.json
├── demo/
│   ├── index.html         # Generated gallery
│   ├── og-image.html
│   └── src/
│       ├── app.js
│       ├── disco.js
│       └── styles.css
├── build.mjs              # Single build entry point
└── scripts/
    ├── check-svelte-types.mjs
    ├── icon-batches.json
    └── icon-batch-prompt.md
```

## Source of Truth

- Artwork lives in `src/svg/{outline,solid,duotone,sharp}/`
- Icon metadata lives in `src/icons.json`
- Batch groupings live in `scripts/icon-batches.json`
- The reusable batch prompt lives in `scripts/icon-batch-prompt.md`
- Generated assets live in `dist/`
- The gallery shell lives in `demo/src/`, while `demo/index.html` is regenerated

Docs should point readers back to those sources instead of treating generated files as editable inputs.

## Build Pipeline

[`build.mjs`](../build.mjs) is the only generator. The default `npm run build` flow is:

1. `stageSvg()` optimizes every source SVG into `dist/svg/`
2. `stageReact()` generates React components in `dist/react/`
3. `stageSvelte()` generates Svelte components and declarations in `dist/svelte/`
4. `stageSprite()` generates `dist/sprite.svg`
5. `stageMetadata()` generates `dist/metadata.json`
6. `stageDemo()` regenerates `demo/index.html`

Flag behavior matters:

- `--react`, `--svelte`, and `--sprite` all re-run SVG optimization first
- `--watch` watches `src/svg/`, `src/icons.json`, and `demo/src/`
- `package.json` also defines `npm run build:demo`, but the current `--demo` path does not populate a manifest before calling `stageDemo()`, so contributor docs should not describe it as a supported standalone rebuild command yet

## Published Package Surface

The package exports are defined in [`package.json`](../package.json).

### Stable, documented entry points

- `@marcus/roc/react/index.js`
- `@marcus/roc/svelte`
- `@marcus/roc/svelte/{style}`
- `@marcus/roc/svelte/{style}/{Icon}.svelte`
- `@marcus/roc/svg/{style}/{name}.svg`
- `@marcus/roc/sprite`
- `@marcus/roc/metadata`

### React caveat

`./react/*` is exported with a wildcard, so generated React subpaths resolve at runtime. The current package only ships a declaration file for `dist/react/index.d.ts`, not for style barrels or per-icon `.jsx` files.

That means:

- `@marcus/roc/react/index.js` is the typed React entry point
- explicit React file imports such as `@marcus/roc/react/{style}/index.js` and `@marcus/roc/react/{style}/{Icon}.jsx` are runtime-valid but not bundled as typed public paths

Consumer docs must keep that distinction explicit until the package starts generating React subpath declarations.

## Documentation Split

Each top-level doc has a different job:

- [`README.md`](../README.md) is the shortest path for consumers
- [`docs/api.md`](api.md) is the precise export and artifact reference
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) is the contributor setup, verification, and batch-authoring guide
- [`CLAUDE.md`](../CLAUDE.md) covers icon design constraints and examples
- [`docs/spec.md`](spec.md) records the internal architecture and doc boundaries

Batch execution guidance intentionally lives in [`CONTRIBUTING.md`](../CONTRIBUTING.md#batch-icon-authoring). [`CLAUDE.md`](../CLAUDE.md) should stay focused on SVG design rules so operational steps do not drift between multiple docs.

If one of these files changes, check whether the others now need updates.

## Verification Rules

When editing docs or the build pipeline:

1. Confirm every command in the docs exists in `package.json`
2. Confirm every package import example matches the export map
3. Confirm every linked file exists
4. Confirm metadata examples match the generated `dist/metadata.json` shape
5. Confirm React docs do not imply typed support for untyped deep imports
6. Confirm contributor docs do not advertise unsupported standalone `build:demo` behavior
7. Confirm the category list in `scripts/icon-batch-prompt.md` still matches `src/icons.json`

## Contributor Workflow Summary

For icon work, the expected loop is:

1. Add or edit the four SVG variants
2. Update `src/icons.json`
3. Run `npm run build`
4. Run `npm run check:types`
5. Verify the gallery with `npm run preview`
6. Include regenerated `dist/` output and `demo/index.html` in the PR when relevant

For multi-icon work, start from the batch-authoring section in [`CONTRIBUTING.md`](../CONTRIBUTING.md#batch-icon-authoring) and use `CLAUDE.md` only for the SVG style rules.
