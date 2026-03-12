# @halo-dev/vite-plugin-halo-theme

[简体中文](./README.zh.md)

A Vite plugin built specifically for Halo theme development.

It precompiles templates before Vite processes HTML, adds lightweight template reuse features (`include`, `slot`, `props`) for Halo themes, and automatically treats HTML files in `src` as multi-page entries output to `templates`.

## Why This Plugin

Halo themes often need reusable page fragments and layout composition.
This plugin fills that gap during precompilation, reducing template duplication and improving maintainability.

Main capabilities:

1. Template reuse features: supports `include`, `slot`, `props`, and related semantics.
2. Automatically scans the `src` directory, uses all HTML files as Vite build entries, and handles static asset imports.

## Install

```bash
pnpm add -D @halo-dev/vite-plugin-halo-theme
```

## Quick Start

Enable the plugin in `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import { haloThemePlugin } from "@halo-dev/vite-plugin-halo-theme";

export default defineConfig({
  plugins: [haloThemePlugin()],
});
```

## Example

See the runnable example project in [`example`](./example).

```bash
cd example
pnpm install
pnpm build
```

## Directory Conventions

This plugin is Halo-specific and uses the following defaults:

- Page source directory: `src`
- Partials directory: `src/partials`
- Static assets directory: `public`
- Output directory: `templates`
- Output assets directory: `templates/assets`

Example structure:

```text
.
├── public
│   └── ...
├── src
│   ├── js
│   │   ├── index.js
│   │   └── post.js
│   ├── css
│   │   └── index.css
│   ├── index.html           # page entry
│   ├── post.html            # page entry
│   └── partials             # template partials directory (convention)
│       ├── layout.html      # partial template
│       └── card.html        # partial template
├── theme.yaml
└── templates                # output directory for templates and assets
```

## Entry Scanning Rules

The plugin scans all `.html` files under `src` and skips `src/partials`.

Mapping examples:

- `src/index.html` -> `templates/index.html`
- `src/post.html` -> `templates/post.html`

## Template Syntax

> Note: The syntax in this section (`include`, `slot`, `props`) is precompiled only during the Vite build phase. It is not native Thymeleaf syntax.  
> Keep the two phases separate: Vite compile time (frontend build) vs Thymeleaf render time (backend runtime).

### Include

```html
<include src="layout.html">
  <main>...</main>
</include>
```

### Props

Usage:

```html
<include src="card.html" title="Hello"></include>
```

In partial:

```html
<h2>{{title}}</h2>
```

### Default Slot

In partial:

```html
<slot />
```

### Named Slot

In partial:

```html
<slot name="head" />
```

Usage:

```html
<include src="layout.html">
  <template name="head">
    <title>Page Title</title>
  </template>
  <main>...</main>
</include>
```

## Include Path Resolution

- `./foo.html` / `../foo.html`: relative to current file
- `/foo.html`: relative to `src`
- `foo.html`: resolves `src/partials/foo.html` first
- `partials/foo.html`: resolves as `src/partials/foo.html`

## Development Commands

```bash
pnpm install
pnpm test
pnpm build
pnpm lint
pnpm fmt
```

## Compatibility and Boundaries

- The current parser is intentionally lightweight and focused on plugin syntax needs, not full HTML5 specification parsing.
- `{{prop}}` is string-level interpolation and does not evaluate expressions.
- This plugin is purpose-built for Halo themes, not a general template engine for all site stacks.
