# Roc

A handcrafted SVG icon library with React, Svelte, and sprite outputs. Every icon ships in 4 styles (outline, solid, duotone, sharp) — optimized with SVGO, built with a single Node.js script.

**[Browse all icons](https://roc.haplab.com)**

## Install

```bash
npm install @marcus/roc
```

Requires Node.js 22+. The only runtime dependency is `svgo`.

## Quick Start

### React

```jsx
import { Home, Bell, Search } from '@marcus/roc/react/outline';

function App() {
  return (
    <nav>
      <Home size={20} className="text-gray-500" />
      <Bell size={20} />
      <Search size={16} /> {/* stroke auto-adjusts to 1.75 at ≤16px */}
    </nav>
  );
}
```

Each style has its own entry point:

```jsx
// Single style
import { Home } from '@marcus/roc/react/outline';
import { Home } from '@marcus/roc/react/solid';
import { Home } from '@marcus/roc/react/duotone';
import { Home } from '@marcus/roc/react/sharp';
```

Stroked icons (outline, duotone, sharp) accept a `strokeWidth` prop. Default stroke width adjusts automatically: `1.75` at 16px, `1.5` at 20px+.

### Svelte

```svelte
<script>
  import Home from '@marcus/roc/svelte/outline/Home.svelte';
  import Bell from '@marcus/roc/svelte/solid/Bell.svelte';
</script>

<Home size={24} class="icon" />
<Bell size={20} />
```

### HTML / Sprite

Copy `dist/sprite.svg` to your public directory, then reference icons by symbol ID:

```html
<svg width="24" height="24" class="text-gray-700">
  <use href="/sprite.svg#home-outline" />
</svg>
```

Symbol IDs follow the `{name}-{style}` pattern (e.g. `bell-solid`, `search-duotone`).

### Raw SVGs

Optimized SVGs are available at `dist/svg/{style}/{name}.svg` for direct use in any framework or tool.

### Metadata

```js
import metadata from '@marcus/roc/metadata';
// { icons: [...], categories: [...], total: N }
```

### Duotone

Duotone icons use a CSS custom property for the background layer. Define it once:

```css
:root {
  --color-duotone-fill: rgba(94, 106, 210, 0.15);
}
```

## Styles

| Style | Description |
|-------|-------------|
| **outline** | Stroke-based with rounded caps and joins |
| **solid** | Filled shapes using `currentColor` |
| **duotone** | Tinted background layer + outline strokes |
| **sharp** | Angular geometry with miter joins and butt caps |

## Development

```bash
npm install
npm run build        # Full pipeline: SVGO + React + Svelte + sprite + demo
npm run preview      # Open demo page in browser
npm run dev          # Watch mode — rebuilds on SVG changes
npm run deploy       # Build + deploy demo to roc.haplab.com
```

Individual stages: `npm run build:svg`, `build:react`, `build:svelte`, `build:sprite`, `build:demo`.

## Changelog Workflow

Generate a Markdown changelog directly from local git commit subjects:

```bash
npm run changelog
```

By default the synthesizer reads the full repository history through `HEAD`. That default is intentional because Roc currently has no release tags or existing changelog automation.

Useful variants:

```bash
npm run changelog -- --from main
npm run changelog -- --range main..HEAD
npm run changelog -- --limit 20 --output CHANGELOG.md
```

Choose either an explicit `--range` or `--from`/`--to` bounds. The CLI rejects mixed usage so invocation stays deterministic.

The generator uses local heuristics to group commit subjects into `Features`, `Fixes`, `Documentation`, `Build & Tooling`, `Icons`, and `Other Changes`. Output is deterministic: commits stay in git log order, empty sections are omitted, and each entry includes its short hash plus commit date.

Validate the synthesizer with:

```bash
npm run check:changelog
```

That check covers fixed fixture-style assertions and a smoke test against the repository's current history so the output structure stays stable even as commits are added.

## Adding Icons

See [CLAUDE.md](CLAUDE.md) for the complete icon creation guide. The short version:

1. Create 4 SVGs in `src/svg/{outline,solid,duotone,sharp}/icon-name.svg`
2. Add metadata to `src/icons.json` (label, description, category, tags)
3. Run `npm run build`
4. Verify in the demo page with `npm run preview`

## License

MIT
