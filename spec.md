# Plan: Icon Library Structure & Build System

## Context

The project currently has a single `index.html` demo page containing 5 handcrafted SVG icons (Home, Analytics, Team, Alerts, Settings) in 4 styles (Outline, Solid, Duotone, Sharp) — 20 icon variants total. All icon definitions live as JavaScript functions generating SVG strings at runtime. The goal is to restructure this into a proper icon library that can be consumed in React, Svelte, and Tailwind projects, with a build pipeline and AI-friendly guides for adding new icons.

---

## Directory Structure

```
icons/
├── CLAUDE.md                     # AI guide for adding new icons
├── package.json                  # Exports map for react/svelte/svg
├── build.mjs                     # Single build script (Node 22, ESM)
├── .gitignore
├── src/
│   └── svg/                      # Source of truth — one file per icon per style
│       ├── outline/
│       │   ├── home.svg
│       │   ├── chart.svg
│       │   ├── users.svg
│       │   ├── bell.svg
│       │   └── settings.svg
│       ├── solid/
│       ├── duotone/
│       └── sharp/
├── dist/                         # Build output (gitignored)
│   ├── svg/                      # SVGO-optimized SVGs (same structure as src)
│   ├── react/                    # JSX components with forwardRef + size prop
│   │   ├── index.js              # Barrel: exports all icons with style suffix
│   │   ├── index.d.ts            # TypeScript declarations
│   │   ├── outline/
│   │   │   ├── index.js
│   │   │   ├── Home.jsx
│   │   │   └── ...
│   │   ├── solid/
│   │   ├── duotone/
│   │   └── sharp/
│   ├── svelte/                   # .svelte components with size prop
│   │   ├── index.js
│   │   ├── outline/
│   │   │   ├── index.js
│   │   │   ├── Home.svelte
│   │   │   └── ...
│   │   ├── solid/
│   │   ├── duotone/
│   │   └── sharp/
│   ├── sprite.svg                # SVG sprite (<symbol> per icon) for Tailwind/HTML
│   └── metadata.json             # Icon manifest (names, styles, tags)
└── demo/
    └── index.html                # Auto-generated demo page (current page, rebuilt from source SVGs)
```

Organized **by style, then icon name** — matches how Heroicons works and how the user's demo page already groups things. Import paths read naturally: `@icons/react/outline`.

---

## Implementation Steps

### Step 1: Project scaffolding

Create `package.json`, `.gitignore`, directory structure (`src/svg/{outline,solid,duotone,sharp}/`).

- **package.json**: `type: "module"`, `private: true`, exports map for `./react/*`, `./svelte/*`, `./svg/*`, `./sprite`, `./metadata`. Scripts: `build`, `build:svg`, `build:react`, `build:svelte`, `build:sprite`, `build:demo`, `dev`, `preview`. Single devDependency: `svgo`.
- **.gitignore**: `node_modules/`, `dist/`

### Step 2: Extract source SVGs from index.html

Parse the existing `index.html` and extract each icon's SVG markup into individual files. There are 20 icons (5 names x 4 styles). Each source SVG:

- Uses `viewBox="0 0 24 24"`, `fill="none"`, no width/height
- Stroke-width hardcoded to `1.5` (dynamic sizing handled by components)
- Uses `currentColor` for theming, `var(--color-duotone-fill)` for duotone backgrounds

Write a one-time extraction section in `build.mjs` or extract manually (20 files is small enough).

### Step 3: Build script (`build.mjs`)

A single Node.js ESM script with 6 pipeline stages. No SVGR or framework-specific tooling — just string templating, which is simpler and more controllable for a small icon set.

**CLI interface:**
```
node build.mjs              # Full rebuild (all stages)
node build.mjs --svg        # Stage 1 only
node build.mjs --react      # Stage 2 only
node build.mjs --svelte     # Stage 3 only
node build.mjs --sprite     # Stage 4 only
node build.mjs --demo       # Stage 6 only
node build.mjs --watch      # Watch src/svg/ and rebuild on change
```

**Stage 1 — SVGO optimization**: Read `src/svg/**/*.svg`, optimize with SVGO (strip metadata, clean paths, remove dimensions), write to `dist/svg/`.

**Stage 2 — React codegen**: For each optimized SVG, generate a JSX component:
- `forwardRef` wrapper with `size` prop (default 24) and `className` spread
- For stroked styles (outline/duotone/sharp): dynamic `strokeWidth` — `sw = strokeWidth ?? (size <= 16 ? 1.75 : 1.5)`
- SVG attributes converted to camelCase (`stroke-width` → `strokeWidth`, `fill-rule` → `fillRule`, etc.)
- Per-style `index.js` barrel files + root `index.js` with style-suffixed names (`HomeOutline`, `HomeSolid`)
- Generated `index.d.ts` with `IconProps` interface

**Stage 3 — Svelte codegen**: Similar to React but using Svelte template syntax:
- `export let size = 24` prop, `{...$$restProps}` spread
- Reactive `$: sw = ...` for dynamic stroke-width
- No attribute camelCase conversion needed (Svelte uses standard HTML attributes)

**Stage 4 — Sprite generation**: Single `dist/sprite.svg` with `<symbol>` per icon, IDs as `{name}-{style}` (e.g., `home-outline`). For Tailwind/HTML usage: `<svg><use href="sprite.svg#home-outline"/></svg>`.

**Stage 5 — Metadata**: `dist/metadata.json` with icon names, styles, counts.

**Stage 6 — Demo page**: Regenerate `demo/index.html` from source SVGs, preserving the existing design (dark/light theme, size selector, copy-to-clipboard, keyboard shortcuts).

### Step 4: CLAUDE.md — AI icon creation guide

The key file for "easy to add new icons." Contains:

- **Quick start**: "Create 4 SVGs → `npm run build` → verify in demo"
- **Foundation rules** (all styles): viewBox 0 0 24 24, no width/height, currentColor only, coordinate precision, visual centering
- **Per-style specifications** with exact attribute requirements and 2 full SVG examples each:
  - **Outline**: `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`, no fills
  - **Solid**: `fill="currentColor"`, `fill-rule="evenodd"` for cutouts, no strokes (except detail elements)
  - **Duotone**: background `fill="var(--color-duotone-fill)"` + outline strokes on top
  - **Sharp**: `stroke-linejoin="miter" stroke-miterlimit="10"`, no round caps, rects instead of circles, straight lines over curves
- **Step-by-step workflow**: design outline first → derive solid → layer duotone → rebuild as sharp
- **Naming conventions**: kebab-case filenames, PascalCase components, `{name}-{style}` sprite IDs
- **Existing icon table** with descriptions
- **Build commands reference**

### Step 5: Install, build, verify

- `npm install` (just svgo)
- `npm run build` — full pipeline
- `npm run preview` — open demo in browser
- Verify: all 20 icons render correctly across styles/sizes, dark/light theme works, React/Svelte components are importable

### Step 6: Git init

Initialize git repo, initial commit.

---

## Consumer Usage

```js
// React — by style
import { Home, Chart } from '@marcus/icons/react/outline';
<Home size={20} className="text-gray-500" />

// React — all icons with style suffix
import { HomeOutline, HomeSolid } from '@marcus/icons/react';

// Svelte
import Home from '@marcus/icons/svelte/outline/Home.svelte';
<Home size={24} class="icon" />

// Tailwind / HTML — sprite
<svg width="24" height="24" class="text-gray-700">
  <use href="/sprite.svg#home-outline" />
</svg>
```

Duotone icons require `--color-duotone-fill` CSS custom property defined by the consuming app (e.g., `rgba(94, 106, 210, 0.15)`).

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `package.json` | Create — exports map, scripts, devDependencies |
| `.gitignore` | Create — node_modules/, dist/ |
| `build.mjs` | Create — main build script (~300-400 lines) |
| `CLAUDE.md` | Create — AI icon creation guide |
| `src/svg/{style}/{name}.svg` | Create — 20 source SVG files extracted from index.html |
| `index.html` | Move to `demo/index.html` (rebuilt by build script) |

---

## Verification

1. `npm run build` completes without errors
2. `dist/` contains svg/, react/, svelte/, sprite.svg, metadata.json
3. `demo/index.html` renders all icons correctly (open in browser)
4. React component smoke test: `node -e "import('./dist/react/outline/Home.jsx')"` loads without error
5. Sprite: open sprite.svg in browser, symbols render
6. Add a test icon (e.g., `src/svg/outline/test.svg`), run build, verify it appears in all outputs
