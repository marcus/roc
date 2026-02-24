# Icon Batch Build Prompt

You are building icons for the `@marcus/roc` icon library. Build exactly the icons listed below. For EACH icon, create all 4 style variants.

## Your Icons to Build

{{ICONS}}

## Rules (follow exactly)

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

After creating SVG files, update `src/icons.json` — add entries for each new icon to the `"icons"` object. Each entry needs: `label`, `description`, `category`, `tags` (array of 4-6 relevant search terms).

Valid categories: Navigation, Data, Communication, People, System, Brand, Media, Files, Commerce, Weather, Devices, Development, Transport, Actions, Objects

Add any new categories to the `"categories"` array if needed.

## Build & Verify

After creating all files, run:
```
npm run build
```

Verify no errors. If build fails, fix and re-run.

## Reference Examples

**Outline (bell):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M5.5 10A6.5 6.5 0 0 1 12 3.5v0A6.5 6.5 0 0 1 18.5 10v2.5c0 1.5.5 2.5 1.5 3.5H4c1-1 1.5-2 1.5-3.5V10Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>
```

**Solid (bell):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M5 10a7 7 0 0 1 14 0v2.5c0 1.3.4 2.2 1.2 3 .3.3.1.8-.3.8H4.1c-.4 0-.6-.5-.3-.8.8-.8 1.2-1.7 1.2-3V10Z" fill="currentColor"/>
  <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
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
