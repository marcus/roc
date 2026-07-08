# Roc

Handcrafted SVG icons for React, Svelte, SVG sprites, and raw asset workflows.

Roc ships four styles for every icon: `outline`, `solid`, `duotone`, and `sharp`. The published package is prebuilt, so consumers install `@marcus/roc` and import the generated assets they need.

**[Browse the icon set](https://roc.haplab.com)**

## Install

```bash
npm install @marcus/roc
```

Consumers do not need to run the build pipeline. If you want to work on the library itself, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Supported Entry Points

| Surface | Import path | Notes |
| --- | --- | --- |
| React style barrels | `@marcus/roc/react/{style}/index.js` | Named exports such as `Home` |
| React per-icon files | `@marcus/roc/react/{style}/{Icon}.jsx` | Default export per file |
| Svelte root barrel | `@marcus/roc/svelte` | Named exports such as `HomeOutline` |
| Svelte style barrels | `@marcus/roc/svelte/{outline\|solid\|duotone\|sharp}` | Named exports such as `Home` |
| Svelte per-icon files | `@marcus/roc/svelte/{style}/{Icon}.svelte` | Default export per file |
| Raw SVG files | `@marcus/roc/svg/{style}/{name}.svg` | Kebab-case filenames |
| SVG sprite | `@marcus/roc/sprite` | Single sprite sheet with `<symbol>` ids |
| Metadata JSON | `@marcus/roc/metadata` | Icon catalog and category data |

The complete export matrix lives in [docs/api.md](docs/api.md).

## Quick Start

### React

Import from a style barrel and use the icon as a normal SVG component:

```jsx
import { Home, Bell, Search } from '@marcus/roc/react/outline/index.js';

export function Nav() {
  return (
    <nav>
      <Home size={20} className="text-gray-500" />
      <Bell size={20} />
      <Search size={16} />
    </nav>
  );
}
```

Stroked styles (`outline`, `duotone`, `sharp`) accept `strokeWidth`. When you do not pass one, Roc uses `1.75` at `16px` and `1.5` at larger sizes.

The explicit `/index.js` path is the safest React barrel import for the current package export map.

```jsx
import Search from '@marcus/roc/react/sharp/Search.jsx';

<Search size={16} strokeWidth={2} />;
```

### Svelte

Use either the style barrel or an individual component file:

```svelte
<script>
  import { Home, Bell } from '@marcus/roc/svelte/outline';
  import Search from '@marcus/roc/svelte/sharp/Search.svelte';
</script>

<Home size={24} class="icon" />
<Bell size={20} />
<Search size={16} />
```

The root Svelte barrel is useful when you want multiple styles in one import:

```svelte
<script>
  import { HomeOutline, BellSolid } from '@marcus/roc/svelte';
</script>
```

### SVG Sprite

Import the sprite file from the package and copy it into your app's public assets, then reference the symbol id as `{name}-{style}`.

```html
<svg width="24" height="24" class="text-gray-700">
  <use href="/sprite.svg#home-outline" />
</svg>
```

### Raw SVG Files

Raw SVG assets are exported from `@marcus/roc/svg/{style}/{name}.svg`. How you consume them depends on your bundler:

```js
import homeSvgUrl from '@marcus/roc/svg/outline/home.svg?url';
import homeSvgMarkup from '@marcus/roc/svg/outline/home.svg?raw';
```

### Metadata

`@marcus/roc/metadata` exports the generated catalog for search UIs, icon pickers, and build-time tooling.

```js
import metadata from '@marcus/roc/metadata';

const home = metadata.icons.find((icon) => icon.name === 'home');
console.log(home.label); // "Home"
console.log(metadata.styles); // ["outline", "solid", "duotone", "sharp"]
```

The metadata JSON includes `icons`, `categories`, `totalCount`, and `styles`.

### Duotone Theming

Duotone icons use `var(--color-duotone-fill)` for the background layer. Define it once in your app theme:

```css
:root {
  --color-duotone-fill: rgba(94, 106, 210, 0.15);
}
```

## Local Development

The repo build is driven by `build.mjs` and the generated output lands in `dist/`.

```bash
npm install
npm run build
npm run check:types
npm run preview
```

Useful stage-specific commands:

```bash
npm run build:svg
npm run build:react
npm run build:svelte
npm run build:sprite
npm run build:demo
npm run dev
```

## Documentation

- [docs/api.md](docs/api.md): public package API and export matrix
- [CONTRIBUTING.md](CONTRIBUTING.md): local setup, add-an-icon workflow, verification, and PR guidance
- [CLAUDE.md](CLAUDE.md): detailed icon design and style rules
- [docs/spec.md](docs/spec.md): internal build and repository architecture

## License

MIT
