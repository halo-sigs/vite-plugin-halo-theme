import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  staged: {
    "**/*": "vp fmt --no-error-on-unmatched-pattern",
    "*.{ts}": ["vp lint"],
  },
  pack: {
    deps: {
      // tsdown <0.23 compatibility: resolve external dependency subpaths.
      // Remove to preserve subpath imports as written (the new default).
      // https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
      resolveDepSubpath: true,
    },
    entry: ["./src/index.ts"],
    format: ["esm"],
    dts: {
      generator: "tsgo",
    },
    exports: true,
  },
  fmt: {
    useTabs: false,
    tabWidth: 2,
    insertFinalNewline: true,
    sortImports: {},
    sortPackageJson: true,
    ignorePatterns: ["example/templates/**"],
  },
  lint: {
    plugins: ["eslint", "typescript", "node", "promise", "oxc"],
    categories: {
      correctness: "error",
      suspicious: "error",
    },
    rules: {
      eqeqeq: "error",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-var": "error",
      "prefer-const": "error",
    },
    options: {
      reportUnusedDisableDirectives: "warn",
      typeAware: true,
      typeCheck: true,
    },
    env: {
      builtin: true,
      node: true,
      es2024: true,
    },
    globals: {},
    ignorePatterns: [
      "dist/**",
      "example/templates/**",
      "node_modules/**",
      "coverage/**",
      "*.d.ts",
      "*.test.ts",
    ],
  },
});
