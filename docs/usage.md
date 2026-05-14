# Usage Reference

Use this guide when you need the exact package entry points and the behavior of the generated outputs.

## Install

```bash
npm install @marcus/roc
```

Consumers do not need the repo build toolchain. Node.js 22+ only matters when you are working on Roc itself.

## Public Entry Points

| Surface | Path | Use when |
|---------|------|----------|
| React root barrel | `@marcus/roc/react` | You want style-suffixed names like `HomeOutline` and `HomeSolid` |
| React style barrel | `@marcus/roc/react/{style}` | You want named exports like `Home` from one style |
| React generated file | `@marcus/roc/react/{style}/{Component}.jsx` | You want one generated JSX file directly |
| Svelte root barrel | `@marcus/roc/svelte` | You want style-suffixed names like `HomeOutline` |
| Svelte style barrel | `@marcus/roc/svelte/{style}` | You want named exports like `Home` from one style |
| Svelte generated file | `@marcus/roc/svelte/{style}/{Component}.svelte` | You want one generated Svelte component directly |
| Optimized SVG | `@marcus/roc/svg/{style}/{name}.svg` | You want the raw SVG asset |
| SVG sprite | `@marcus/roc/sprite` | You want `<symbol>`-based sprite usage |
| Metadata manifest | `@marcus/roc/metadata` | You want searchable icon metadata |

Available styles are `outline`, `solid`, `duotone`, and `sharp`.

## React

Style barrels are the main React entry points:

```jsx
import { Home, Bell, Search } from '@marcus/roc/react/outline';

export function App() {
  return (
    <nav>
      <Home size={20} />
      <Bell size={20} className="text-gray-500" />
      <Search size={16} />
    </nav>
  );
}
```

The root barrel exports every icon with a style suffix:

```jsx
import { HomeOutline, HomeSolid, HomeDuotone, HomeSharp } from '@marcus/roc/react';
```

Direct file imports are also exported if you want a single generated module:

```jsx
import Home from '@marcus/roc/react/outline/Home.jsx';
```

### React props

| Prop | Applies to | Notes |
|------|------------|-------|
| `size` | all React icons | Sets both `width` and `height`; default `24` |
| `strokeWidth` | `outline`, `duotone`, `sharp` | Overrides the generated stroke width |
| `className` | all React icons | Passed to the root `<svg>` |
| other SVG props | all React icons | Spread onto the root `<svg>` |

For stroked React icons, the generated default stroke width is:

- `1.75` when `size <= 16`
- `1.5` for larger sizes

Solid icons do not use `strokeWidth`.

## Svelte

Style barrels are the main Svelte entry points:

```svelte
<script>
  import { Home } from '@marcus/roc/svelte/outline';
  import { Bell } from '@marcus/roc/svelte/solid';
</script>

<Home size={24} class="icon" />
<Bell size={20} />
```

The root barrel exports style-suffixed names:

```svelte
<script>
  import { HomeOutline, HomeSolid } from '@marcus/roc/svelte';
</script>
```

Direct component imports are also exported:

```svelte
<script>
  import Home from '@marcus/roc/svelte/outline/Home.svelte';
</script>
```

### Svelte props

| Prop | Applies to | Notes |
|------|------------|-------|
| `size` | all Svelte icons | Sets both `width` and `height`; default `24` |
| `strokeWidth` | `outline`, `duotone`, `sharp` | Overrides the generated stroke width |
| other SVG attributes | all Svelte icons | Forwarded to the root `<svg>` |

For stroked Svelte icons, the generated stroke width follows the same defaults as React:

- `1.75` when `size <= 16`
- `1.5` for larger sizes

## Raw SVG

Every optimized source SVG is exported from `@marcus/roc/svg/{style}/{name}.svg`.

```js
import homeOutlineUrl from '@marcus/roc/svg/outline/home.svg';
```

How that import resolves depends on your bundler. In asset-aware bundlers such as Vite, it usually resolves to a URL. In other setups, treat the exported path as a raw file you copy into your own asset pipeline.

## Sprite

`@marcus/roc/sprite` resolves to the generated sprite file.

```js
import spriteUrl from '@marcus/roc/sprite';
```

```html
<svg width="24" height="24" aria-hidden="true">
  <use href="/sprite.svg#home-outline"></use>
</svg>
```

Sprite symbol IDs always use the `{name}-{style}` pattern, such as `home-outline` or `bell-solid`.

## Metadata

`@marcus/roc/metadata` resolves to `dist/metadata.json`.

```js
import metadata from '@marcus/roc/metadata' with { type: 'json' };
```

The manifest shape is:

```js
{
  icons: [
    {
      name: 'home',
      label: 'Home',
      description: 'House shape for navigation and home actions',
      category: 'Navigation',
      tags: ['house', 'main', 'start', 'dashboard', 'landing'],
      styles: ['outline', 'solid', 'duotone', 'sharp']
    }
  ],
  categories: ['Navigation', 'Data', 'Communication'],
  totalCount: 4,
  styles: ['outline', 'solid', 'duotone', 'sharp']
}
```

`totalCount` is the number of built icon variants. `icons.length` is the number of unique icon names.

## Duotone Theming

Duotone icons use `var(--color-duotone-fill)` for the background layer. Define it once in your app theme:

```css
:root {
  --color-duotone-fill: rgba(94, 106, 210, 0.15);
}
```

The foreground layer still uses `currentColor`, so text color utilities continue to work.
