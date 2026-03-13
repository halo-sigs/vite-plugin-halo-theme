import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "**/*": "vp fmt --no-error-on-unmatched-pattern",
    "*.{ts}": ["vp lint"],
  },
  pack: {
    entry: ["./src/index.ts"],
    format: ["esm"],
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  fmt: {
    useTabs: false,
    tabWidth: 2,
    insertFinalNewline: true,
    sortImports: {},
    sortPackageJson: true,
    ignorePatterns: ["./example/templates/**"],
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
