# Icon Batch Build Prompt

You are building icons for the `@marcus/roc` icon library. Build exactly the icons listed below. For EACH icon, create all 4 style variants.

## Your Icons to Build

{{ICONS}}

## Rules (follow exactly)

Use [`scripts/icon-batches.json`](icon-batches.json) as the source for batch groupings. Stay within the assigned batch unless the request explicitly expands scope.

### File Locations
For each icon `{name}`, create:
- `src/svg/outline/{name}.svg`
- `src/svg/solid/{name}.svg`
- `src/svg/duotone/{name}.svg`
- `src/svg/sharp/{name}.svg`

### SVG Root Element (ALL files)
```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
```
No `width`/`height`. Always `fill="none"` on root.

### Outline Style
- `stroke="currentColor"` `stroke-width="1.5"` on shape elements
- `stroke-linecap="round"` on open paths
- `stroke-linejoin="round"` on paths with joins
- No fill on shapes

### Solid Style
- `fill="currentColor"` on shapes, no strokes
- Use `fill-rule="evenodd" clip-rule="evenodd"` for shapes with cutouts/holes
- Combine into single `<path>` where practical

### Duotone Style
- First child: background shape with `fill="var(--color-duotone-fill)"`
- Then outline strokes on top (same as outline style)
- Background shape is the outer silhouette

### Sharp Style
- `stroke="currentColor"` `stroke-width="1.5"`
- `stroke-linejoin="miter"` `stroke-miterlimit="10"`
- NO `stroke-linecap="round"` (use default butt)
- Angular geometry: straight lines, no rounded corners, rects instead of circles

### Quality Rules
- Only `currentColor` and `var(--color-duotone-fill)` for colors
- Max 2 decimal places on coordinates
- Content within 2–22 coordinate range
- No `<title>`, `<desc>`, `<defs>`, comments
- Icons must be visually recognizable and well-crafted at 24x24

## Ontology Update

After creating SVG files, update `src/icons.json` — add entries for each new icon to the `"icons"` object. Each entry needs: `label`, `description`, `category`, `tags` (array of 4-6 relevant search terms). Match the existing category spelling and capitalization exactly.

Valid categories: Navigation, Data, Communication, People, System, Brand, Actions, Files, Media, Weather, Transport, Commerce, Development, Devices, Objects, Food, Gaming, Nature, Sports, Countries

Only add a new category to the top-level `"categories"` array when the ontology is intentionally expanding in the same change.

## Build & Verify

After creating all files, run:
```
npm run build
npm run check:types
```

Verify both commands succeed. If either command fails, fix the issues and re-run.

When the batch changes source SVGs or `src/icons.json`, keep the regenerated `dist/` output and `demo/index.html` in the same PR or patch.

## Reference Examples

**Outline (bell):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M5.5 10A6.5 6.5 0 0 1 12 3.5v0A6.5 6.5 0 0 1 18.5 10v2.5c0 1.5.5 2.5 1.5 3.5H4c1-1 1.5-2 1.5-3.5V10Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>
```

**Solid (home):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M12.39 2.6a.6.6 0 0 0-.78 0L3.36 9.48A1.5 1.5 0 0 0 2.83 10.6V19.5A1.5 1.5 0 0 0 4.33 21H9.5v-6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6h5.17a1.5 1.5 0 0 0 1.5-1.5V10.6a1.5 1.5 0 0 0-.53-1.14L12.39 2.6Z" fill="currentColor"/>
</svg>
```

**Duotone (bell):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M5.5 10A6.5 6.5 0 0 1 12 3.5v0A6.5 6.5 0 0 1 18.5 10v2.5c0 1.5.5 2.5 1.5 3.5H4c1-1 1.5-2 1.5-3.5V10Z" fill="var(--color-duotone-fill)"/>
  <path d="M5.5 10A6.5 6.5 0 0 1 12 3.5v0A6.5 6.5 0 0 1 18.5 10v2.5c0 1.5.5 2.5 1.5 3.5H4c1-1 1.5-2 1.5-3.5V10Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>
```

**Sharp (bell):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M5 10c0-3.87 3.13-7 7-7s7 3.13 7 7v6H5v-6Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter" stroke-miterlimit="10"/>
  <path d="M3 16h18M9 19h6" stroke="currentColor" stroke-width="1.5"/>
</svg>
```
