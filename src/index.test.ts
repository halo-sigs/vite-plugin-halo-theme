import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { haloThemePlugin } from "./index";

function writeFile(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

describe("haloThemePlugin", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(path.join(os.tmpdir(), "halo-plugin-"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  function normalizePath(filePath: string): string {
    return filePath.replace(/^\/private(?=\/var\/)/, "");
  }

  function callConfigHook(plugin: ReturnType<typeof haloThemePlugin>): unknown {
    const hook = plugin.config;
    if (!hook) {
      return undefined;
    }

    if (typeof hook === "function") {
      return hook.call({} as never, {} as never, {} as never);
    }

    return hook.handler.call({} as never, {} as never, {} as never);
  }

  function callTransformHook(
    plugin: ReturnType<typeof haloThemePlugin>,
    html: string,
    context: { path?: string; filename?: string },
  ): string {
    const hook = plugin.transformIndexHtml;
    if (!hook || typeof hook !== "object") {
      throw new Error("transformIndexHtml hook must exist");
    }

    const transformed = hook.handler.call({} as never, html, context as never);
    if (typeof transformed !== "string") {
      throw new Error("transformIndexHtml handler should return transformed html string");
    }
    return transformed;
  }

  it("throws clear error when theme.yaml is missing", () => {
    process.chdir(tempDir);
    expect(() => haloThemePlugin()).toThrow(/Halo theme config not found/);
  });

  it("throws clear error when metadata.name is missing", () => {
    writeFile(path.join(tempDir, "theme.yaml"), "metadata: {}");
    process.chdir(tempDir);

    expect(() => haloThemePlugin()).toThrow(/Could not read metadata\.name/);
  });

  it("provides fixed Halo-oriented build config and html entries", () => {
    writeFile(path.join(tempDir, "theme.yaml"), "metadata:\n  name: theme-cartly\n");
    writeFile(path.join(tempDir, "src", "index.html"), "<!doctype html><html></html>");
    writeFile(path.join(tempDir, "src", "post.html"), "<!doctype html><html></html>");
    writeFile(path.join(tempDir, "src", "shop", "index.html"), "<!doctype html><html></html>");
    writeFile(path.join(tempDir, "src", "shop", "payments.html"), "<!doctype html><html></html>");
    writeFile(path.join(tempDir, "src", "partials", "layout.html"), "<section></section>");
    process.chdir(tempDir);

    const plugin = haloThemePlugin();
    const userConfig = callConfigHook(plugin);
    if (!userConfig || typeof userConfig !== "object") {
      throw new Error("plugin config must return an object");
    }
    const typedConfig = userConfig as {
      root: string;
      publicDir: string;
      base: string;
      build: unknown;
    };

    expect(normalizePath(typedConfig.root)).toBe(normalizePath(path.join(tempDir, "src")));
    expect(normalizePath(typedConfig.publicDir)).toBe(normalizePath(path.join(tempDir, "public")));
    expect(typedConfig.base).toBe("/themes/theme-cartly");

    const build = typedConfig.build;
    if (!build || typeof build !== "object" || !("rollupOptions" in build)) {
      throw new Error("plugin build config is required");
    }
    const typedBuild = build as {
      outDir: string;
      assetsDir: string;
      emptyOutDir: boolean;
      rollupOptions: unknown;
    };

    expect(normalizePath(typedBuild.outDir)).toBe(normalizePath(path.join(tempDir, "templates")));
    expect(typedBuild.assetsDir).toBe("assets");
    expect(typedBuild.emptyOutDir).toBe(true);

    const rollupOptions = typedBuild.rollupOptions;
    if (!rollupOptions || typeof rollupOptions !== "object" || !("input" in rollupOptions)) {
      throw new Error("rollupOptions.input is required");
    }

    const normalizedInput = Object.fromEntries(
      Object.entries(rollupOptions.input as Record<string, string>).map(([key, value]) => [
        key,
        normalizePath(value),
      ]),
    );

    expect(normalizedInput).toEqual({
      index: normalizePath(path.join(tempDir, "src", "index.html")),
      post: normalizePath(path.join(tempDir, "src", "post.html")),
      shop: normalizePath(path.join(tempDir, "src", "shop", "index.html")),
      "shop/payments": normalizePath(path.join(tempDir, "src", "shop", "payments.html")),
    });
  });

  it("registers pre transform hook and compiles include templates", () => {
    writeFile(path.join(tempDir, "theme.yaml"), "metadata:\n  name: test-theme\n");
    writeFile(path.join(tempDir, "src", "partials", "layout.html"), "<main><slot /></main>");
    process.chdir(tempDir);

    const plugin = haloThemePlugin();

    if (!plugin.transformIndexHtml || typeof plugin.transformIndexHtml !== "object") {
      throw new Error("transformIndexHtml hook must exist");
    }

    expect(plugin.transformIndexHtml.order).toBe("pre");

    const transformed = callTransformHook(
      plugin,
      `<include src="layout.html"><article>Hello</article></include>`,
      { path: "/index.html" },
    );
    expect(transformed).toContain("<main><article>Hello</article></main>");
  });

  it("resolves current html file from filename when provided", () => {
    writeFile(path.join(tempDir, "theme.yaml"), "metadata:\n  name: test-theme\n");
    writeFile(path.join(tempDir, "src", "pages", "parts", "box.html"), "<div><slot /></div>");
    process.chdir(tempDir);

    const plugin = haloThemePlugin();
    if (!plugin.transformIndexHtml || typeof plugin.transformIndexHtml !== "object") {
      throw new Error("transformIndexHtml hook must exist");
    }

    const transformed = callTransformHook(
      plugin,
      `<include src="./parts/box.html"><span>Scoped</span></include>`,
      {
        filename: path.join(tempDir, "src", "pages", "about.html"),
      },
    );

    expect(transformed).toContain("<div><span>Scoped</span></div>");
  });
});
