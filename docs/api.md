# API Reference

This document describes the published package surface for `@marcus/roc` as it exists today. It is meant to stay aligned with [`package.json`](../package.json), the generated files in [`dist/`](../dist), and the build behavior in [`build.mjs`](../build.mjs).

## Export Matrix

| Import path | Resolves to | TypeScript support | Execution notes |
| --- | --- | --- | --- |
| `@marcus/roc/react/index.js` | `dist/react/index.js` | Yes | Requires a React toolchain that transpiles `.jsx` dependencies |
| `@marcus/roc/react/{style}/index.js` | `dist/react/{style}/index.js` | No bundled `.d.ts` | Requires a React toolchain that transpiles `.jsx` dependencies |
| `@marcus/roc/react/{style}/{Icon}.jsx` | `dist/react/{style}/{Icon}.jsx` | No bundled `.d.ts` | Requires a React toolchain that transpiles `.jsx` dependencies |
| `@marcus/roc/svelte` | `dist/svelte/index.js` | Yes | Root Svelte barrel with style-suffixed names |
| `@marcus/roc/svelte/{style}` | `dist/svelte/{style}/index.js` | Yes | Preferred Svelte style barrels |
| `@marcus/roc/svelte/{style}/{Icon}.svelte` | `dist/svelte/{style}/{Icon}.svelte` | Via Svelte tooling | Direct generated component file |
| `@marcus/roc/svg/{style}/{name}.svg` | `dist/svg/{style}/{name}.svg` | Asset handling depends on bundler | Optimized source SVG |
| `@marcus/roc/sprite` | `dist/sprite.svg` | N/A | SVG sprite sheet |
| `@marcus/roc/metadata` | `dist/metadata.json` | Runtime-dependent JSON import syntax | Icon manifest |

`@marcus/roc/react` is not exported. Use `@marcus/roc/react/index.js`.

The wildcard export also makes `@marcus/roc/react/{style}` resolve to a directory target, but plain Node ESM rejects that directory import. If you use the generated React style barrel, keep the explicit `/index.js`.

All published React entry points ultimately import generated `.jsx` files. Export resolution succeeds, but bare Node ESM cannot execute those files without a JSX-aware loader or bundler.

## React

### Preferred import path

```jsx
import { HomeOutline, SearchSharp } from '@marcus/roc/react/index.js';
```

The root React barrel exports style-suffixed component names. Each component is a `forwardRef` SVG component with:

- `size?: number`
- `className?: string`
- all standard SVG props
- `strokeWidth?: number` on stroked styles

For `outline`, `duotone`, and `sharp`, the generated component uses:

- `1.75` when `size <= 16`
- `1.5` otherwise

`solid` icons ignore `strokeWidth`.

Use the React exports in frameworks or bundlers that already handle JSX in dependencies. In bare Node ESM, `import '@marcus/roc/react/index.js'` fails with `ERR_UNKNOWN_FILE_EXTENSION` because the generated files use the `.jsx` extension.

### Deep React imports

These paths are published through the package export map:

```jsx
import { Home } from '@marcus/roc/react/outline/index.js';
import Search from '@marcus/roc/react/sharp/Search.jsx';
```

They are intended for React-aware bundlers and frameworks, not bare Node ESM. They also do not ship matching declaration files in the current package. In strict TypeScript projects, they produce `TS7016`. Keep consumer-facing TypeScript examples on the root React barrel until the package gains typed React subpath declarations.

## Svelte

### Root barrel

Use the root barrel when you want style-suffixed names:

```svelte
<script>
  import { HomeOutline, SearchSharp } from '@marcus/roc/svelte';
</script>
```

### Style barrels

Use the style barrel when you want unsuffixed names:

```svelte
<script>
  import { Home, Search } from '@marcus/roc/svelte/outline';
</script>
```

### Direct component imports

Generated `.svelte` files are available directly:

```svelte
<script>
  import Home from '@marcus/roc/svelte/outline/Home.svelte';
</script>
```

Svelte components accept `size` plus normal SVG attributes. The stroked variants derive stroke width from `size` internally.

## Sprite

`@marcus/roc/sprite` resolves to the generated sprite sheet. Symbol IDs use `{name}-{style}`:

```html
<svg width="24" height="24">
  <use href="/sprite.svg#search-outline" />
</svg>
```

The repo also keeps the generated file at [`dist/sprite.svg`](../dist/sprite.svg).

## Raw SVG Files

Each optimized SVG is published as a file export:

```js
import searchOutlineUrl from '@marcus/roc/svg/outline/search.svg';
```

This is most useful in bundlers that treat SVG imports as URL or asset modules.

## Metadata JSON

`@marcus/roc/metadata` resolves to the generated manifest at [`dist/metadata.json`](../dist/metadata.json).

In modern ESM runtimes:

```js
const { default: metadata } = await import('@marcus/roc/metadata', {
  with: { type: 'json' },
});
```

Shape:

```ts
type RocMetadata = {
  icons: Array<{
    name: string;
    label: string;
    description: string;
    category: string;
    tags: string[];
    styles: Array<'outline' | 'solid' | 'duotone' | 'sharp'>;
  }>;
  categories: string[];
  totalCount: number;
  styles: Array<'outline' | 'solid' | 'duotone' | 'sharp'>;
};
```

The current build contains 501 icons and 2,004 style variants.

## Generated Output Layout

`npm run build` writes these outputs:

- [`dist/svg/`](../dist/svg) for optimized SVG sources
- [`dist/react/`](../dist/react) for generated React components and the root declaration file
- [`dist/svelte/`](../dist/svelte) for generated Svelte components and declaration files
- [`dist/sprite.svg`](../dist/sprite.svg) for the HTML sprite
- [`dist/metadata.json`](../dist/metadata.json) for the icon manifest
- [`demo/index.html`](../demo/index.html) for the gallery app
