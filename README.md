# Roc

A handcrafted SVG icon library with React, Svelte, raw SVG, sprite, and metadata outputs. Every icon ships in 4 styles: `outline`, `solid`, `duotone`, and `sharp`.

**[Browse all icons](https://roc.haplab.com)**

## Install

```bash
npm install @marcus/roc
```

Requires Node.js 22+.

## Documentation

- [`README.md`](README.md): quick start and output overview
- [`docs/usage.md`](docs/usage.md): public import paths, framework usage, sprite/SVG examples, metadata shape
- [`docs/adding-icons.md`](docs/adding-icons.md): maintainer workflow for adding icons, rebuilding outputs, and validating the package
- [`CLAUDE.md`](CLAUDE.md): detailed icon drawing and style rules

## Quick Start

### React

```jsx
import { Home, Bell, Search } from '@marcus/roc/react/outline';

function App() {
  return (
    <nav>
      <Home size={20} className="text-gray-500" />
      <Bell size={20} />
      <Search size={16} />
    </nav>
  );
}
```

Stroked React icons (`outline`, `duotone`, `sharp`) accept `strokeWidth`. If you do not pass one, the generated components use `1.75` at `16px` and `1.5` at larger sizes.

### Svelte

```svelte
<script>
  import { Home } from '@marcus/roc/svelte/outline';
  import BellSolid from '@marcus/roc/svelte/solid/Bell.svelte';
</script>

<Home size={24} class="icon" />
<BellSolid size={20} />
```

### Sprite

```html
<svg width="24" height="24" class="text-gray-700">
  <use href="/sprite.svg#home-outline" />
</svg>
```

Sprite symbol IDs follow the `{name}-{style}` pattern, such as `bell-solid` and `search-duotone`.

## Output Types

| Output | What it supports |
|--------|------------------|
| React | Style-based component barrels such as `@marcus/roc/react/outline` |
| Svelte | Root and style-based component barrels plus direct `.svelte` imports |
| Raw SVG | Individual optimized SVG files by style and icon name |
| Sprite | One `sprite.svg` file with a `<symbol>` for every icon/style pair |
| Metadata | JSON manifest with icon labels, descriptions, categories, tags, and styles |

## Duotone

Duotone icons use `var(--color-duotone-fill)` for the background layer. Define it once in your app:

```css
:root {
  --color-duotone-fill: rgba(94, 106, 210, 0.15);
}
```

## Development

```bash
npm install
npm run build
npm run preview
```

Useful stage commands:

- `npm run build:svg`
- `npm run build:react`
- `npm run build:svelte`
- `npm run build:sprite`
- `npm run build:demo`
- `npm run verify:package`

## Adding Icons

Use [`docs/adding-icons.md`](docs/adding-icons.md) for the maintainer workflow, then consult [`CLAUDE.md`](CLAUDE.md) for the detailed style rules that each source SVG must follow.

## License

MIT
