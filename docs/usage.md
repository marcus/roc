# Usage

`@marcus/roc` ships five consumer-facing output types:

- React components
- Svelte components
- Raw SVG files
- An SVG sprite
- Metadata JSON

The public import paths below come from [`package.json`](../package.json). If an import path is not listed here, do not rely on it as part of the published package API.

## Install

```bash
npm install @marcus/roc
```

## Public Import Paths

| Output | Public path | Notes |
|--------|-------------|-------|
| React style barrels | `@marcus/roc/react/{outline|solid|duotone|sharp}` | Named exports such as `Home` and `Bell` |
| React direct files | `@marcus/roc/react/{style}/{Icon}.jsx` | Direct component file access if you prefer file imports |
| Svelte root barrel | `@marcus/roc/svelte` | Suffixed exports such as `HomeOutline` and `HomeSolid` |
| Svelte style barrels | `@marcus/roc/svelte/{outline|solid|duotone|sharp}` | Named exports such as `Home` |
| Svelte direct files | `@marcus/roc/svelte/{style}/{Icon}.svelte` | Direct component file access |
| Raw SVG | `@marcus/roc/svg/{style}/{name}.svg` | Optimized SVG asset per icon/style pair |
| Sprite | `@marcus/roc/sprite` | Resolves to the generated `sprite.svg` asset |
| Metadata | `@marcus/roc/metadata` | Default JSON export |

> **Note**: The build generates `dist/react/index.js`, but `@marcus/roc/react` is not exported publicly right now. Use the style-specific React entry points instead.

## React

Import from a style barrel when you want standard icon names:

```jsx
import { Home, Search, Bell } from '@marcus/roc/react/outline';

export function Nav() {
  return (
    <nav>
      <Home size={20} className="text-slate-700" />
      <Bell size={20} />
      <Search size={16} />
    </nav>
  );
}
```

You can also import a single generated file directly:

```jsx
import Home from '@marcus/roc/react/outline/Home.jsx';
```

### React Props

All React icons forward regular SVG props to the root `<svg>`.

| Prop | Applies to | Behavior |
|------|------------|----------|
| `size` | all styles | Sets both `width` and `height`; defaults to `24` |
| `className` | all styles | Applied to the root `<svg>` |
| `strokeWidth` | `outline`, `duotone`, `sharp` | Overrides the generated stroke width |

Stroked React icons use this default stroke behavior when `strokeWidth` is omitted:

- `size <= 16`: `1.75`
- `size > 16`: `1.5`

Solid icons do not use stroke-width logic.

## Svelte

Style barrels work well when you want unsuffixed icon names:

```svelte
<script>
  import { Home, Search } from '@marcus/roc/svelte/outline';
  import { Bell } from '@marcus/roc/svelte/solid';
</script>

<Home size={24} class="icon" />
<Search size={16} />
<Bell size={20} />
```

The root Svelte barrel exports style-suffixed components:

```svelte
<script>
  import { HomeOutline, HomeSolid } from '@marcus/roc/svelte';
</script>

<HomeOutline size={24} />
<HomeSolid size={24} />
```

You can also import a single generated component file:

```svelte
<script>
  import Home from '@marcus/roc/svelte/outline/Home.svelte';
</script>
```

### Svelte Props

Generated Svelte components accept a `size` prop and pass remaining attributes through to the root `<svg>`.

- `size` defaults to `24`
- `class`, `aria-*`, `data-*`, and other SVG attributes pass through
- stroked styles auto-adjust stroke width using the same threshold as React

Unlike the React components, the generated Svelte components do not expose a dedicated `strokeWidth` prop. Their internal stroke width is derived from `size`.

## Raw SVG

Each optimized SVG is exported by style and icon name:

```js
import homeOutlineUrl from '@marcus/roc/svg/outline/home.svg';
import bellSolidUrl from '@marcus/roc/svg/solid/bell.svg';
```

This is useful when you want to hand the asset URL to another toolchain or render the file outside React and Svelte.

Maintainers can also find the generated files in `dist/svg/{style}/{name}.svg` after running `npm run build`.

## Sprite

The sprite output contains one `<symbol>` per icon/style pair and uses the `{name}-{style}` naming convention.

If your bundler can import SVG assets as URLs, import the sprite and reference its symbol IDs:

```jsx
import spriteUrl from '@marcus/roc/sprite';

export function SpriteIcon() {
  return (
    <svg width="24" height="24" aria-hidden="true">
      <use href={`${spriteUrl}#home-outline`} />
    </svg>
  );
}
```

If you copy the built file to your public directory, the same symbol IDs apply:

```html
<svg width="24" height="24">
  <use href="/sprite.svg#search-duotone" />
</svg>
```

## Metadata

The metadata export is the generated `dist/metadata.json` manifest:

```js
import metadata from '@marcus/roc/metadata';

console.log(metadata.icons[0]);
```

Each icon entry has this shape:

```js
{
  name: 'home',
  label: 'Home',
  description: 'House shape for navigation and home actions',
  category: 'Navigation',
  tags: ['house', 'main', 'start', 'dashboard', 'landing'],
  styles: ['outline', 'solid', 'duotone', 'sharp']
}
```

The root object also includes:

- `categories`: ordered category list from `src/icons.json`
- `totalCount`: total generated variants across all styles
- `styles`: the style set, currently `outline`, `solid`, `duotone`, and `sharp`

## Duotone Theming

Duotone icons use `var(--color-duotone-fill)` for the background layer. Define that custom property in your app before rendering duotone icons:

```css
:root {
  --color-duotone-fill: rgba(94, 106, 210, 0.15);
}
```

Without it, the duotone background layer will not render with the intended tint.
