# Adding Icons

Use this guide for the human workflow around adding a new icon. For the detailed drawing rules for each style, keep [CLAUDE.md](../CLAUDE.md) open beside this document.

## Prerequisites

- Use Node.js 22+ for local builds
- Work from the repo root
- Plan to add all 4 styles for every new icon: `outline`, `solid`, `duotone`, and `sharp`

## 1. Create the SVG files

Add one source SVG per style:

```text
src/svg/outline/icon-name.svg
src/svg/solid/icon-name.svg
src/svg/duotone/icon-name.svg
src/svg/sharp/icon-name.svg
```

Use kebab-case for the filename. The build turns `icon-name.svg` into `IconName` for the generated React and Svelte components.

## 2. Add metadata in `src/icons.json`

Add a new entry under `icons` with the same kebab-case key:

```json
"icon-name": {
  "label": "Icon Name",
  "description": "Short human-facing description",
  "category": "Navigation",
  "tags": ["search", "discover", "lookup"]
}
```

Keep `category` aligned with the values in the top-level `categories` array. If you need a new category, add it there first.

## 3. Follow the style rules from `CLAUDE.md`

The design constraints live in [CLAUDE.md](../CLAUDE.md). Use it for:

- the required root `<svg>` shape
- outline, solid, duotone, and sharp attribute rules
- naming conventions
- the design workflow for deriving all 4 variants from one concept

This guide is about process. `CLAUDE.md` is the visual spec.

## 4. Run the build

For the normal workflow, run the full build:

```bash
npm run build
```

That regenerates:

- `dist/svg/`
- `dist/react/`
- `dist/svelte/`
- `dist/sprite.svg`
- `dist/metadata.json`
- `demo/index.html`

If you need to debug a single stage, these commands map directly to the build script:

```bash
npm run build:svg
npm run build:react
npm run build:svelte
npm run build:sprite
npm run build:demo
```

`npm run dev` watches `src/svg/` and the demo source files and reruns the build on change.

## 5. Preview the demo

Open the generated demo page to review the new icon across styles, sizes, and themes:

```bash
npm run preview
```

`npm run preview` uses `open demo/index.html`, so if that command is not available on your platform, open `demo/index.html` manually.

Check:

- the icon reads clearly at `16`, `20`, `24`, `32`, and `48`
- the outline, duotone, and sharp variants look balanced with the generated stroke widths
- the duotone background fill works with your `--color-duotone-fill` theme value
- the icon appears in the expected search results and category grouping

## 6. Validate the packaged outputs

Run the package verification after the build:

```bash
npm run verify:package
```

This packs the library into a tarball, installs it into a temporary fixture, and checks that the published React and Svelte entry points resolve with TypeScript.

## 7. Sanity-check the generated paths

After a successful build, your icon should appear in these generated locations:

```text
dist/svg/{style}/icon-name.svg
dist/react/{style}/IconName.jsx
dist/svelte/{style}/IconName.svelte
```

It should also be available through the package entry points:

- `@marcus/roc/react/{style}`
- `@marcus/roc/react/{style}/IconName.jsx`
- `@marcus/roc/svelte/{style}`
- `@marcus/roc/svelte/{style}/IconName.svelte`
- `@marcus/roc/svg/{style}/icon-name.svg`

## Short Checklist

1. Add all 4 SVG source files in `src/svg/`.
2. Add the matching metadata entry in `src/icons.json`.
3. Use [CLAUDE.md](../CLAUDE.md) to verify the style rules.
4. Run `npm run build`.
5. Review the result in the demo.
6. Run `npm run verify:package`.
