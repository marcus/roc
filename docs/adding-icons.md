# Adding Icons

This guide covers the human workflow for adding a new icon to Roc and verifying that it ships correctly in every generated output. Use [`CLAUDE.md`](../CLAUDE.md) alongside this guide for the strict drawing and style rules.

## Before You Start

Every icon must exist in all four styles:

- `outline`
- `solid`
- `duotone`
- `sharp`

Source SVGs live in `src/svg/{style}/` and use kebab-case filenames such as `external-link.svg`. Generated component names become PascalCase, and sprite symbols use `{name}-{style}`.

## 1. Create the Source SVGs

Create one source file per style:

```text
src/svg/outline/{icon-name}.svg
src/svg/solid/{icon-name}.svg
src/svg/duotone/{icon-name}.svg
src/svg/sharp/{icon-name}.svg
```

Recommended workflow:

1. Design the `outline` variant first.
2. Derive `solid` from the same core geometry.
3. Add the `duotone` background layer under the outline strokes.
4. Rebuild the icon for the `sharp` style instead of only swapping stroke attributes.

For the exact SVG structure, required attributes, and per-style examples, use [`CLAUDE.md`](../CLAUDE.md).

## 2. Update `src/icons.json`

Add a new entry under `icons` in [`src/icons.json`](../src/icons.json):

```json
"external-link": {
  "label": "External Link",
  "description": "Outbound link arrow for opening a destination in a new context",
  "category": "Actions",
  "tags": ["link", "outbound", "open", "new tab", "redirect"]
}
```

Checklist:

- use the kebab-case icon filename as the object key
- provide `label`, `description`, `category`, and `tags`
- choose a `category` that already exists in the top-level `categories` array

## 3. Run the Build Pipeline

For normal icon work, run the full build:

```bash
npm run build
```

That runs the stages implemented in [`build.mjs`](../build.mjs):

- `build:svg`: optimize `src/svg/` into `dist/svg/`
- `build:react`: generate React components in `dist/react/`
- `build:svelte`: generate Svelte components in `dist/svelte/`
- `build:sprite`: generate `dist/sprite.svg`
- `build:demo`: regenerate `demo/index.html`

Use the individual scripts when you only need to inspect one stage during development.

## 4. Preview the Demo

Open the generated demo page:

```bash
npm run preview
```

Check the new icon in all four styles and at multiple sizes. Pay special attention to:

- optical balance at `16`, `20`, and `24`
- stroke clarity for `outline`, `duotone`, and `sharp`
- duotone fill layering
- whether the icon reads clearly beside existing icons in the same category

## 5. Validate the Generated Outputs

Run the package verification step after the build:

```bash
npm run verify:package
```

Then spot-check the generated files for your icon:

- `dist/svg/{style}/{icon-name}.svg`
- `dist/react/{style}/{IconName}.jsx`
- `dist/svelte/{style}/{IconName}.svelte`
- `dist/sprite.svg`
- `dist/metadata.json`

What to confirm:

- the icon appears in all four output families
- the React component name matches the PascalCase filename
- the Svelte component name matches the PascalCase filename
- the sprite includes IDs such as `{icon-name}-outline`
- the metadata entry contains the new label, description, category, tags, and all four styles

## 6. Common Maintainer Notes

- `README.md` should stay lightweight. Put detailed consumer behavior in [`docs/usage.md`](./usage.md).
- The published package ships `dist/`, not the demo sources. Consumer docs should point to package export paths such as `@marcus/roc/svelte/outline`.
- React consumers should use style-specific entry points like `@marcus/roc/react/outline`. There is no public `@marcus/roc/react` export today.
- When the icon design itself is in question, defer to [`CLAUDE.md`](../CLAUDE.md). This guide is about workflow, not art direction.
