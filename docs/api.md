# API Reference

This document describes the public package surface exported by `@marcus/roc`.

## Export Matrix

| Public export | Contents | Example |
| --- | --- | --- |
| `@marcus/roc/react/{style}/index.js` | React style barrel with named exports | `import { Home } from '@marcus/roc/react/outline/index.js';` |
| `@marcus/roc/react/{style}/{Icon}.jsx` | Individual React component file with a default export | `import Home from '@marcus/roc/react/outline/Home.jsx';` |
| `@marcus/roc/svelte` | Root Svelte barrel with style-suffixed named exports | `import { HomeOutline } from '@marcus/roc/svelte';` |
| `@marcus/roc/svelte/{style}` | Svelte style barrel with named exports | `import { Home } from '@marcus/roc/svelte/outline';` |
| `@marcus/roc/svelte/{style}/{Icon}.svelte` | Individual Svelte component file with a default export | `import Home from '@marcus/roc/svelte/outline/Home.svelte';` |
| `@marcus/roc/svg/{style}/{name}.svg` | Raw optimized SVG file | `import homeUrl from '@marcus/roc/svg/outline/home.svg?url';` |
| `@marcus/roc/sprite` | Combined sprite sheet | `import spriteHref from '@marcus/roc/sprite';` |
| `@marcus/roc/metadata` | Generated metadata JSON | `import metadata from '@marcus/roc/metadata';` |

Valid styles are `outline`, `solid`, `duotone`, and `sharp`.

> **Note:** `dist/react/index.js` exists in generated output, but `@marcus/roc/react` is not currently exported from `package.json`. The generated React style barrels also live under directories such as `dist/react/outline/`, so the explicit `/index.js` form is the most reliable documented import path.

## React

### Style Barrels

Each React style barrel exports named components whose names are derived from the kebab-case SVG filename.

```jsx
import { Home, Bell, Search } from '@marcus/roc/react/outline/index.js';
```

`home.svg` becomes `Home`, `arrow-left.svg` becomes `ArrowLeft`, and `amazon-logo.svg` becomes `AmazonLogo`.

### Per-Icon Files

Every generated React file default-exports a single icon component:

```jsx
import Search from '@marcus/roc/react/sharp/Search.jsx';
```

Generated files land in `dist/react/{style}/{Icon}.jsx`.

### React Props

React icons render an `<svg>` and forward standard SVG props and refs.

| Prop | Type | Applies to | Notes |
| --- | --- | --- | --- |
| `size` | `number` | all icons | Sets both `width` and `height`; default `24` |
| `strokeWidth` | `number` | `outline`, `duotone`, `sharp` | Overrides automatic stroke sizing |
| `className` | `string` | all icons | Passed through to the root `<svg>` |
| other SVG props | native SVG props | all icons | Forwarded to the root `<svg>` |

Default stroke sizing for stroked React icons:

- `1.75` when `size <= 16`
- `1.5` for larger sizes

Solid icons ignore `strokeWidth`.

## Svelte

### Root Barrel

`@marcus/roc/svelte` exports all icons with style suffixes:

```svelte
<script>
  import { HomeOutline, HomeSolid, HomeDuotone, HomeSharp } from '@marcus/roc/svelte';
</script>
```

### Style Barrels

Style barrels export unsuffixed icon names:

```svelte
<script>
  import { Home, Bell } from '@marcus/roc/svelte/outline';
</script>
```

### Per-Icon Files

Individual component files default-export a single Svelte component:

```svelte
<script>
  import Home from '@marcus/roc/svelte/outline/Home.svelte';
</script>
```

Generated files land in `dist/svelte/{style}/{Icon}.svelte`.

### Svelte Props

Svelte icons expose a `size` prop and forward remaining SVG attributes to the root `<svg>`.

| Prop | Type | Applies to | Notes |
| --- | --- | --- | --- |
| `size` | `number \| string` | all icons | Sets `width` and `height`; default `24` |
| other SVG attributes | forwarded | all icons | Includes `class`, `aria-*`, `stroke-width`, and similar |

For stroked Svelte styles, the generated component derives the default stroke width from `size` in the same way as the React output.

## SVG Sprite

`@marcus/roc/sprite` resolves to `dist/sprite.svg`, which contains one `<symbol>` per icon variant.

Symbol ids follow the pattern `{name}-{style}`:

- `home-outline`
- `bell-solid`
- `search-duotone`

Usage:

```html
<svg width="24" height="24">
  <use href="/sprite.svg#home-outline" />
</svg>
```

## Raw SVG Files

`@marcus/roc/svg/{style}/{name}.svg` exposes the optimized SVG file written by the SVGO stage.

Examples:

```js
import homeUrl from '@marcus/roc/svg/outline/home.svg?url';
import homeMarkup from '@marcus/roc/svg/outline/home.svg?raw';
```

The package ships the file; whether you import it as a URL, string, or asset module depends on your bundler.

Generated files land in `dist/svg/{style}/{name}.svg`.

## Metadata JSON

`@marcus/roc/metadata` resolves to `dist/metadata.json`.

Shape:

```ts
type IconMetadata = {
  name: string;
  label: string;
  description: string;
  category: string;
  tags: string[];
  styles: Array<'outline' | 'solid' | 'duotone' | 'sharp'>;
};

type Metadata = {
  icons: IconMetadata[];
  categories: string[];
  totalCount: number;
  styles: Array<'outline' | 'solid' | 'duotone' | 'sharp'>;
};
```

Notes:

- `icons` contains one entry per icon name, not one per icon variant.
- `totalCount` counts style variants across the whole library.
- `styles` reflects the global style set generated by the build.

Example:

```js
import metadata from '@marcus/roc/metadata';

const search = metadata.icons.find((icon) => icon.name === 'search');
const categories = metadata.categories;
```

## Generated Output Layout

The build writes the published package contents into `dist/`:

```text
dist/
  metadata.json
  sprite.svg
  react/
    {style}/
      {Icon}.jsx
      index.js
  svelte/
    index.js
    index.d.ts
    {style}/
      {Icon}.svelte
      index.js
      index.d.ts
  svg/
    {style}/
      {name}.svg
```

`dist/` is generated and gitignored in this repository. Run `npm run build` to regenerate it locally.
