# Roc

A handcrafted SVG icon library with React, Svelte, raw SVG, sprite, and metadata outputs. Every icon ships in 4 styles: outline, solid, duotone, and sharp.

**[Browse all icons](https://roc.haplab.com)**

## Install

```bash
npm install @marcus/roc
```

## Documentation

- [Usage reference](docs/usage.md) for package entry points, props, sprites, raw SVGs, and metadata
- [Adding icons](docs/adding-icons.md) for the maintainer workflow
- [CLAUDE.md](CLAUDE.md) for the detailed style rules used when drawing new icons

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

Primary React entry points:

- `@marcus/roc/react/{style}` for named exports like `Home`
- `@marcus/roc/react` for style-suffixed exports like `HomeOutline`

### Svelte

```svelte
<script>
  import { Home } from '@marcus/roc/svelte/outline';
  import { Bell } from '@marcus/roc/svelte/solid';
</script>

<Home size={24} class="icon" />
<Bell size={20} />
```

## Output Types

| Output | Entry point | Notes |
|--------|-------------|-------|
| React | `@marcus/roc/react`, `@marcus/roc/react/{style}` | Typed JSX components |
| Svelte | `@marcus/roc/svelte`, `@marcus/roc/svelte/{style}` | Typed Svelte components |
| Raw SVG | `@marcus/roc/svg/{style}/{name}.svg` | Optimized source files |
| Sprite | `@marcus/roc/sprite` | Symbol IDs use `{name}-{style}` |
| Metadata | `@marcus/roc/metadata` | JSON manifest with icons, categories, styles, and `totalCount` |

Stroked icons in `outline`, `duotone`, and `sharp` accept `strokeWidth`. When you omit it, generated components use `1.75` at `16px` and `1.5` at larger sizes. Duotone icons also expect a `--color-duotone-fill` CSS custom property in the consuming app.

## Development

```bash
npm install
npm run build        # Full pipeline: SVGO + React + Svelte + sprite + demo
npm run verify:package
npm run preview      # Open demo page in browser
npm run dev          # Watch mode — rebuilds on SVG changes
npm run deploy       # Build + deploy demo to roc.haplab.com
```

Maintainers should use Node.js 22+ for the build tooling. For the full add-icon workflow, start with [docs/adding-icons.md](docs/adding-icons.md).

## License

MIT
