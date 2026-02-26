# Icon Creation Guide

This guide specifies how to create new SVG icons for the `@marcus/roc` library. Follow these rules exactly to maintain visual consistency across all styles and ensure the build pipeline works correctly.

---

## Quick Start

To add a new icon

1. Create 4 SVG files:
   - `src/svg/outline/{{icon}}.svg`
   - `src/svg/solid/{{icon}}.svg`
   - `src/svg/duotone/{{icon}}.svg`
   - `src/svg/sharp/{{icon}}.svg`
2. Add an entry to `src/icons.json` with `label`, `description`, `category`, and `tags`
3. Run `npm run build`
4. Run `npm run preview` to verify in the demo page

Each file must follow the style-specific rules below. Design the **outline** variant first, then derive the other three.

---

## Foundation Rules (All Styles)

Every icon SVG must satisfy these constraints:

- **Root element**: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">`
- **No `width` or `height` attributes** on the root `<svg>` element (sizing is handled by consumers)
- **`fill="none"` on root** `<svg>` element always
- **`currentColor` only** for all stroke and fill values (no hardcoded hex, rgb, or named colors). The one exception is `var(--color-duotone-fill)` for duotone background layers.
- **Coordinate precision**: maximum 2 decimal places (e.g., `3.5` not `3.5127`)
- **Visual centering**: the icon should appear optically centered within the 24x24 grid
- **Edge padding**: keep content within roughly the 2--22 coordinate range (~1px padding from edges)
- **No metadata**: no `<title>`, `<desc>`, `<defs>`, or comments in source SVGs

---

## Per-Style Specifications

### Outline

Stroke-based icons with rounded joins and caps.

**Required attributes on shape elements:**
- `stroke="currentColor"`
- `stroke-width="1.5"`
- `stroke-linecap="round"` (on open paths)
- `stroke-linejoin="round"` (on paths with joins)

**Rules:**
- No `fill` attributes on shapes (only `fill="none"` on root `<svg>`)
- Use `<path>`, `<circle>`, `<rect>` as appropriate
- Rounded corners on rectangles use `rx` attribute

**Example -- `outline/home.svg`:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M3.5 10.25V19.5a1 1 0 0 0 1 1H9v-5.25a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V20.5h4.5a1 1 0 0 0 1-1V10.25a1 1 0 0 0-.36-.77L12.39 3.1a.6.6 0 0 0-.78 0L3.86 9.48a1 1 0 0 0-.36.77Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

**Example -- `outline/bell.svg`:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M5.5 10A6.5 6.5 0 0 1 12 3.5v0A6.5 6.5 0 0 1 18.5 10v2.5c0 1.5.5 2.5 1.5 3.5H4c1-1 1.5-2 1.5-3.5V10Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>
```

---

### Solid

Filled icons using `currentColor`. No visible strokes.

**Required attributes on shape elements:**
- `fill="currentColor"` on all shapes
- `fill-rule="evenodd"` and `clip-rule="evenodd"` when the icon has cutouts or negative space (e.g., a window inside a house, bars inside a rounded rect)

**Rules:**
- No `stroke` attributes (exception: rare small detail strokes where a fill approach is impractical)
- Combine shapes into a single `<path>` with `fill-rule="evenodd"` where possible
- Cutout/hole shapes are defined as inner sub-paths within the same `<path>` element

**Example -- `solid/home.svg`:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M12.39 2.6a.6.6 0 0 0-.78 0L3.36 9.48A1.5 1.5 0 0 0 2.83 10.6V19.5A1.5 1.5 0 0 0 4.33 21H9.5v-6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6h5.17a1.5 1.5 0 0 0 1.5-1.5V10.6a1.5 1.5 0 0 0-.53-1.14L12.39 2.6Z" fill="currentColor"/>
</svg>
```

**Example -- `solid/chart.svg`:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M4 2.5A1.5 1.5 0 0 0 2.5 4v16A1.5 1.5 0 0 0 4 21.5h16a1.5 1.5 0 0 0 1.5-1.5V4A1.5 1.5 0 0 0 20 2.5H4ZM6.25 13a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4Zm5-4a.75.75 0 0 1 1.5 0v8a.75.75 0 0 1-1.5 0V9Zm5-2.25a.75.75 0 0 1 1.5 0V17a.75.75 0 0 1-1.5 0V6.75Z" fill="currentColor"/>
</svg>
```

---

### Duotone

Two-layer icons: a filled background shape plus outline strokes on top.

**Background layer attributes:**
- `fill="var(--color-duotone-fill)"` for the background shape
- The background shape can also carry `stroke="currentColor"` and other outline attributes if it shares the same path

**Foreground layer attributes (same as outline):**
- `stroke="currentColor"` `stroke-width="1.5"` `stroke-linecap="round"` `stroke-linejoin="round"`

**Rules:**
- Background shape comes **first** in DOM order (painted behind strokes)
- The background fill uses `var(--color-duotone-fill)`, which the consuming app defines (e.g., `rgba(94, 106, 210, 0.15)`)
- Foreground strokes are identical to the outline style
- Some elements may combine both fill and stroke on the same element (see `duotone/users.svg`)

**Example -- `duotone/home.svg`:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M3.5 10.25V19.5a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1V10.25a1 1 0 0 0-.36-.77L12.39 3.1a.6.6 0 0 0-.78 0L3.86 9.48a1 1 0 0 0-.36.77Z" fill="var(--color-duotone-fill)"/>
  <path d="M3.5 10.25V19.5a1 1 0 0 0 1 1H9v-5.25a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V20.5h4.5a1 1 0 0 0 1-1V10.25a1 1 0 0 0-.36-.77L12.39 3.1a.6.6 0 0 0-.78 0L3.86 9.48a1 1 0 0 0-.36.77Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

**Example -- `duotone/users.svg`:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <circle cx="9" cy="7.5" r="3.5" fill="var(--color-duotone-fill)" stroke="currentColor" stroke-width="1.5"/>
  <path d="M2.5 20.5v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" fill="var(--color-duotone-fill)" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M16 7.13a3.5 3.5 0 0 1 0 6.5M19.5 20.5v-1a5 5 0 0 0-3-4.58" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
</svg>
```

---

### Sharp

Angular icons with miter joins and butt line caps. No rounded corners.

**Required attributes on shape elements:**
- `stroke="currentColor"` `stroke-width="1.5"`
- `stroke-linejoin="miter"` `stroke-miterlimit="10"` (on shapes with joins)
- **No** `stroke-linecap="round"` (use the default `butt` cap)

**Rules:**
- Use `<rect>` instead of `<circle>` where possible
- Prefer straight lines over curves
- No `rx`/`ry` on rectangles (sharp corners)
- Rebuild the icon geometry with angular forms, not just swapping attributes on the outline version

**Example -- `sharp/home.svg`:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M3 10.5V21h6.5v-6h5v6H21V10.5L12 3 3 10.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter" stroke-miterlimit="10"/>
</svg>
```

**Example -- `sharp/chart.svg`:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <rect x="3" y="3" width="18" height="18" stroke="currentColor" stroke-width="1.5"/>
  <path d="M7 17V13M12 17V8M17 17V6" stroke="currentColor" stroke-width="1.5"/>
</svg>
```

---

## Step-by-Step Workflow

When creating a new icon, follow this order:

### 1. Design the outline variant first
Start with the outline style. This establishes the icon's core geometry using strokes. Keep it simple and recognizable at 24x24 and down to 16x16.

### 2. Derive solid by filling the outline shape
Take the outline paths and convert them to filled shapes:
- Replace `stroke="currentColor"` with `fill="currentColor"`
- Remove all stroke attributes
- Expand stroked paths into filled outlines (the shape should look like the outline but filled in)
- Use `fill-rule="evenodd"` for shapes that need cutouts or holes
- Combine sub-shapes into a single `<path>` where practical

### 3. Layer duotone by adding background fill under outline
Copy the outline variant, then:
- Add a simplified background shape as the **first** child element with `fill="var(--color-duotone-fill)"`
- The background shape is typically the outer silhouette of the icon (without interior details)
- Keep the outline strokes on top, unchanged
- Some elements may combine fill and stroke on the same element

### 4. Rebuild as sharp: replace curves with lines, circles with rects
Redesign the icon with angular geometry:
- Replace curved paths with straight-line segments
- Replace `<circle>` with `<rect>`
- Remove all rounded corners (`rx`/`ry`)
- Use `stroke-linejoin="miter"` and `stroke-miterlimit="10"`
- Remove `stroke-linecap="round"` (use default butt caps)
- The icon should convey the same meaning but with a distinctly angular aesthetic

---

## Naming Conventions

| Context | Format | Example |
|---------|--------|---------|
| SVG filenames | kebab-case | `arrow-left.svg` |
| React components | PascalCase | `ArrowLeft` |
| Svelte components | PascalCase | `ArrowLeft.svelte` |
| Sprite symbol IDs | `{name}-{style}` | `arrow-left-outline` |
| Import paths (React) | `@marcus/roc/react/{style}` | `import { ArrowLeft } from '@marcus/roc/react/outline'` |
| Import paths (Svelte) | `@marcus/roc/svelte/{style}` | `import ArrowLeft from '@marcus/roc/svelte/outline/ArrowLeft.svelte'` |

---

## Existing Icons

| Name | Description |
|------|-------------|
| home | House shape -- navigation/home action |
| chart | Bar chart inside a rounded rect (outline) or filled rect (solid) |
| users | Two-person team silhouette -- contacts/team |
| bell | Notification bell with clapper |
| settings | Sun/gear shape with radiating lines and center circle |
| roc | Mythical giant bird in flight -- project namesake |

Each icon exists in all 4 styles: `outline`, `solid`, `duotone`, `sharp`.

Source files are at `src/svg/{style}/{name}.svg`.

---

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Full pipeline -- optimizes SVGs, generates React/Svelte components, sprite, and demo |
| `npm run build:svg` | SVGO optimization only (`src/svg/` to `dist/svg/`) |
| `npm run build:react` | Generate React JSX components in `dist/react/` |
| `npm run build:svelte` | Generate Svelte components in `dist/svelte/` |
| `npm run build:sprite` | Generate `dist/sprite.svg` with `<symbol>` elements |
| `npm run build:demo` | Regenerate `demo/index.html` from `demo/src/` + source SVGs |
| `npm run dev` | Watch mode -- rebuilds on changes to `src/svg/` and `demo/src/` |
| `npm run preview` | Open `demo/index.html` in the browser |

---

## Demo Page Architecture

The demo page (`demo/index.html`) is a single-file app assembled by the build from multiple sources. **Never edit `demo/index.html` directly** -- it is regenerated on every build.

### Source files

| File | Contents | Interpolated? |
|------|----------|---------------|
| `demo/src/styles.css` | All CSS (tokens, layout, components, responsive) | No -- static |
| `demo/src/app.js` | App logic (render, search, filter, detail panel, URL sync, keyboard shortcuts) | No -- static |
| `demo/src/disco.js` | Easter egg: disco mode triggered by double-clicking the disco-ball icon | No -- static |

### Generated content (in `build.mjs` `stageDemo()`)

The HTML skeleton and JS data block remain in `build.mjs` as a template literal because they contain build-time interpolations:

- **HTML**: icon count in meta tags, inline SVGs for logo/search/theme icons, category buttons from ontology
- **JS data**: `ICONS` (all SVG inner content by style+name), `ICON_META`, `STYLE_META`, `CATEGORIES`, `STYLE_ORDER`, `ICON_NAMES`, `STROKED_STYLES`

### Assembly order in generated output

1. `<style>` -- contents of `demo/src/styles.css`
2. HTML body -- skeleton with interpolated SVGs and category buttons
3. `<script>` -- JS data block (interpolated) + contents of `demo/src/app.js`
4. `<script>` -- contents of `demo/src/disco.js`

### Editing the demo

- **CSS/JS changes**: edit files in `demo/src/`, then run `npm run build:demo`
- **In watch mode** (`npm run dev`): changes to `demo/src/` auto-rebuild the demo page only (skips SVG optimization)
- **Adding icons**: add SVGs to `src/svg/{style}/` + entry in `src/icons.json`, then `npm run build`

---

## Batch Icon Creation (Orchestration)

When creating multiple icons at once, **always use the sub-agent pattern**:

1. **The main agent acts as orchestrator** -- it does NOT create SVG files itself
2. **Group icons into thematic batches** of 2--4 icons (e.g., "currency icons", "programming language icons", "bird icons")
3. **Launch one sub-agent per batch** using the Task tool, running them in parallel
4. Each sub-agent receives:
   - The list of icon names it's responsible for
   - The full style specifications from this guide (or a reference to read CLAUDE.md)
   - Instructions to create all 4 variants per icon and add entries to `src/icons.json`
5. **After all sub-agents complete**, the orchestrator:
   - Runs `npm run build` to verify everything compiles
   - Runs `npm run deploy` if requested
   - Summarizes what was created

Always commit and push changes after icons are created.

**Example batch groupings:**
- UI actions: `sign-in`, `sign-out`, `lock`, `unlock`
- Currencies: `dollar`, `euro`, `pound`, `yen`, `bitcoin`
- Programming: `ruby`, `python`, `rust`, `go`
- Animals/nature: `eagle`, `osprey`, `fire`

---

## Checklist for New Icons

Before submitting a new icon, verify:

- [ ] All 4 style variants exist (`outline`, `solid`, `duotone`, `sharp`)
- [ ] Every SVG has `viewBox="0 0 24 24"` and `fill="none"` on root, no `width`/`height`
- [ ] Only `currentColor` and `var(--color-duotone-fill)` are used for colors
- [ ] Coordinates use at most 2 decimal places
- [ ] Content stays within the 2--22 coordinate range
- [ ] `npm run build` completes without errors
- [ ] Icon renders correctly in all 4 styles in the demo page
- [ ] Filename is kebab-case and descriptive
- [ ] Ontology entry added to `src/icons.json` with label, description, category, and tags
