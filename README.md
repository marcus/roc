# Roc

Handcrafted SVG icons for React, Svelte, sprites, and raw SVG workflows. The package currently ships 501 icons in 4 styles: outline, solid, duotone, and sharp.

**[Browse the icon gallery](https://roc.haplab.com)**

## Install

```bash
npm install @marcus/roc
```

The published package contains generated ESM assets under `dist/` and does not bundle any runtime dependencies. React apps still need `react`, and Svelte apps still need `svelte`.

If you want to build Roc locally, use Node.js 22+.

## Quick Start

### React

Use the typed root React barrel in React toolchains that compile JSX from dependencies:

```jsx
import { BellOutline, HomeOutline, SearchSharp } from '@marcus/roc/react/index.js';

export function App() {
  return (
    <nav>
      <HomeOutline size={20} className="text-gray-500" />
      <BellOutline size={20} />
      <SearchSharp size={16} />
    </nav>
  );
}
```

React exports use style-suffixed names such as `HomeOutline`, `HomeSolid`, `HomeDuotone`, and `HomeSharp`.

Stroked React icons accept `strokeWidth`. When you do not pass one, Roc uses `1.75` at `size <= 16` and `1.5` above that.

> **Note**: Roc's React output is published as generated `.jsx` files. Use it in bundlers or frameworks that transpile JSX in dependencies, such as Vite or Next.js. Bare Node ESM imports fail with `ERR_UNKNOWN_FILE_EXTENSION`, and only `@marcus/roc/react/index.js` ships bundled TypeScript declarations today.

### Svelte

Use the typed style barrels for unsuffixed names:

```svelte
<script>
  import { Bell, Home, Search } from '@marcus/roc/svelte/outline';
</script>

<nav>
  <Home size={20} class="icon" />
  <Bell size={20} />
  <Search size={16} />
</nav>
```

You can also use the root Svelte barrel when you want style-suffixed exports:

```svelte
<script>
  import { HomeOutline, BellSolid } from '@marcus/roc/svelte';
</script>
```

### Sprite

Copy [`dist/sprite.svg`](dist/sprite.svg) into your app's public assets, then reference symbols as `{name}-{style}`:

```html
<svg width="24" height="24" class="text-gray-700">
  <use href="/sprite.svg#home-outline" />
</svg>
```

### Raw SVGs

Optimized SVGs are exported from `@marcus/roc/svg/*`. In bundlers that support asset imports, you can import them directly:

```js
import homeOutlineUrl from '@marcus/roc/svg/outline/home.svg';
```

### Metadata

`@marcus/roc/metadata` resolves to [`dist/metadata.json`](dist/metadata.json):

```js
const { default: metadata } = await import('@marcus/roc/metadata', {
  with: { type: 'json' },
});

console.log(metadata.icons.length); // 501
console.log(metadata.totalCount);   // 2004
```

## Duotone Theming

Duotone icons use `--color-duotone-fill` for the background layer.

```css
:root {
  --color-duotone-fill: rgba(94, 106, 210, 0.15);
}
```

## Styles

| Style | Description |
| --- | --- |
| `outline` | Rounded stroke icons for general UI use |
| `solid` | Filled silhouettes using `currentColor` |
| `duotone` | Background fill plus foreground strokes |
| `sharp` | Angular geometry with miter joins |

## Build Commands

```bash
npm install
npm run build
npm run check:types
npm run preview
```

Other useful commands:

- `npm run dev` watches `src/svg/`, `src/icons.json`, and `demo/src/`
- `npm run build:svg` regenerates optimized SVGs
- `npm run build:react` regenerates React output
- `npm run build:svelte` regenerates Svelte output
- `npm run build:sprite` regenerates the SVG sprite
- `npm run build:demo` regenerates [`demo/index.html`](demo/index.html)

## Documentation

- [API reference](docs/api.md)
- [Contributing guide](CONTRIBUTING.md)
- [Icon design rules](CLAUDE.md)
- [Internal build spec](docs/spec.md)

## License

MIT
