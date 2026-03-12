# AGENTS.md

## Project Overview

`@halo-dev/vite-plugin-halo-theme` is a Vite plugin built specifically for Halo themes.

Core responsibilities:

- Treat HTML files in `src` as multi-page Vite entries.
- Run template compilation in `transformIndexHtml` with `order: "pre"`.
- Support `<include>`, `{{prop}}`, default slots, named slots, slot fallback, recursive include, and circular include protection.

Design intent:

- These pre-compilation features (`include`, slots, and related semantics) primarily exist to compensate for gaps in Halo's underlying template engine, Thymeleaf, for theme-level component reuse and composition.

## Fixed Conventions

- Page source directory: `src`
- Partials directory: `src/partials`
- Static assets directory: `public`
- Output directory: `templates`
- Output assets directory: `templates/assets`
- `base` value: read `metadata.name` from `theme.yaml`, then generate `/themes/{themeName}`

These conventions are part of the plugin contract. Do not generalize them into full runtime configuration unless explicitly requested.

## Key Files

- Plugin entry: `src/index.ts`
- Compiler entry: `src/template-compiler/index.ts`
- Compiler semantics: `src/template-compiler/compiler.ts`
- Parser: `src/template-compiler/parser.ts`
- Generator: `src/template-compiler/generator.ts`
- Tests:
  - `src/index.test.ts`
  - `src/template-compiler/compiler.test.ts`

## Setup And Commands

- Install dependencies: `pnpm install`
- Build: `pnpm build`
- Test: `pnpm test`
- Test watch mode: `pnpm test:watch`
- Lint: `pnpm lint`
- Format: `pnpm fmt`
- Package check: `pnpm pack`

## Implementation Guardrails

- Keep `transformIndexHtml.order = "pre"`.
- Entry scanning must skip `src/partials`.
- Preserve entry mapping:
  - `src/index.html -> index`
  - `src/a/b.html -> a/b`
  - `src/a/index.html -> a`
- Keep template compilation AST-based (`parse -> transform -> generate`), do not regress to regex-only templating.
- On errors, return readable HTML comments (for example `<!-- Partial error: ... -->`) and keep useful logs.

## Include Resolution Rules

`<include src="...">` resolution rules:

- `./foo.html` or `../foo.html`: relative to current file
- `/foo.html`: relative to `src`
- `foo.html`: resolve from `src/partials/foo.html` first
- `partials/foo.html`: resolve as `src/partials/foo.html`

## Testing Expectations

When changing template semantics, entry scanning, path resolution, or error handling, add or update tests.

At minimum, run:

- `pnpm test`
- `pnpm build`

## Packaging Rules

- Publish only runtime-required files (currently controlled by `package.json` `files`).
- `prepack` should build before packaging.
- Do not include `src`, test files, or editor config files in the final tarball.

## Notes For Agents

- This is a Halo-specific plugin. Prefer stable conventions over broad configurability.
- Borrowing ideas from generic plugins is acceptable, but implementation structure and expression should remain independent.
- If paths or behavior change, update this file and related tests accordingly.
