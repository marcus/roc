# Roc

A handcrafted SVG icon library with React, Svelte, and sprite outputs. 6 icons in 4 styles (outline, solid, duotone, sharp) — optimized with SVGO, built with a single Node.js script.

## Install

```bash
npm install @marcus/roc
```

Requires Node.js 22+. The only dependency is `svgo`.

## Usage

### React

```jsx
// Import by style
import { Home, Bell } from '@marcus/roc/react/outline';

<Home size={20} className="text-gray-500" />

// Import all with style suffix
import { HomeOutline, HomeSolid } from '@marcus/roc/react';
```

Stroked icons (outline, duotone, sharp) accept a `strokeWidth` prop. Default stroke width adjusts automatically: `1.75` at 16px, `1.5` at 20px+.

### Svelte

```svelte
<script>
  import Home from '@marcus/roc/svelte/outline/Home.svelte';
</script>

<Home size={24} class="icon" />
```

### HTML / Sprite

```html
<svg width="24" height="24" class="text-gray-700">
  <use href="/sprite.svg#home-outline" />
</svg>
```

Symbol IDs follow the `{name}-{style}` pattern.

### Duotone

Duotone icons require a CSS custom property for the background fill:

```css
:root {
  --color-duotone-fill: rgba(94, 106, 210, 0.15);
}
```

## Icons

| Name | Description |
|------|-------------|
| home | House — navigation/home action |
| chart | Bar chart — analytics/metrics |
| users | Two-person silhouette — team/contacts |
| bell | Notification bell — alerts |
| settings | Sun/gear shape — configuration |
| roc | Mythical bird in flight — project namesake |

Each icon is available in all 4 styles: **outline**, **solid**, **duotone**, **sharp**.

## Development

```bash
npm install
npm run build        # Full pipeline: SVGO + React + Svelte + sprite + demo
npm run preview      # Open demo page in browser
npm run dev          # Watch mode — rebuilds on SVG changes
```

Individual stages: `npm run build:svg`, `build:react`, `build:svelte`, `build:sprite`, `build:demo`.

## Adding Icons

See [CLAUDE.md](CLAUDE.md) for the complete icon creation guide. The short version:

1. Create 4 SVGs in `src/svg/{outline,solid,duotone,sharp}/icon-name.svg`
2. Run `npm run build`
3. Verify in the demo page with `npm run preview`

## License

MIT
