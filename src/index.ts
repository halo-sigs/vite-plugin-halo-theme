import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Theme } from "@halo-dev/api-client";
import type { IndexHtmlTransformContext, Plugin } from "vite";
import { parse } from "yaml";

import { name as packageName } from "../package.json";
import { compileTemplate, createRenderContext, type CompilerOptions } from "./template-compiler";

const SRC_DIR = "src";
const PARTIALS_DIR = "partials";
const OUT_DIR = "templates";
const ASSETS_DIR = "assets";
const EMPTY_OUT_DIR = true;
const HTML_EXTENSION = ".html";
const PLUGIN_LOG_PREFIX = `[${packageName}]`;

interface ResolvedPluginOptions {
  base: string;
  projectRoot: string;
  srcRoot: string;
  partialsRoot: string;
}

export function haloThemePlugin(): Plugin {
  const resolvedOptions = resolveHaloThemeBuildOptions();
  const compilerOptions: CompilerOptions = {
    srcRoot: resolvedOptions.srcRoot,
    partialsRoot: resolvedOptions.partialsRoot,
  };

  return {
    name: "vite-plugin-halo-theme",

    config() {
      return {
        root: resolvedOptions.srcRoot,
        publicDir: path.resolve(resolvedOptions.projectRoot, "public"),
        base: resolvedOptions.base,
        build: {
          outDir: path.resolve(resolvedOptions.projectRoot, OUT_DIR),
          assetsDir: ASSETS_DIR,
          emptyOutDir: EMPTY_OUT_DIR,
          rollupOptions: {
            input: collectThemeTemplateEntries(resolvedOptions),
          },
        },
      };
    },

    transformIndexHtml: {
      order: "pre",
      handler(html: string, ctx: IndexHtmlTransformContext) {
        const currentFile = resolveCurrentHtmlFile(ctx, resolvedOptions);

        return compileTemplate(
          html,
          createRenderContext({
            options: compilerOptions,
            currentFile,
            stack: [currentFile],
          }),
        );
      },
    },
  };
}

function resolveHaloThemeBuildOptions(): ResolvedPluginOptions {
  const projectRoot = process.cwd();
  const themeName = readHaloThemeName(projectRoot);

  return {
    base: `/themes/${themeName}`,
    projectRoot,
    srcRoot: path.resolve(projectRoot, SRC_DIR),
    partialsRoot: path.resolve(projectRoot, SRC_DIR, PARTIALS_DIR),
  };
}

function readHaloThemeName(projectRoot: string): string {
  const themeConfigPath = path.resolve(projectRoot, "theme.yaml");

  if (!existsSync(themeConfigPath)) {
    throw new Error(`${PLUGIN_LOG_PREFIX} Halo theme config not found: ${themeConfigPath}`);
  }

  const content = readFileSync(themeConfigPath, "utf-8");
  const parsed = parse(content) as Theme | undefined;
  const themeName = parsed?.metadata?.name;

  if (typeof themeName !== "string" || themeName.trim().length === 0) {
    throw new Error(`${PLUGIN_LOG_PREFIX} Could not read metadata.name from ${themeConfigPath}`);
  }

  return themeName.trim();
}

function resolveCurrentHtmlFile(
  ctx: IndexHtmlTransformContext,
  options: ResolvedPluginOptions,
): string {
  for (const resolver of htmlFileResolvers) {
    const candidate = resolver(ctx, options);
    if (candidate) {
      return candidate;
    }
  }
  return path.resolve(options.srcRoot, "index.html");
}

type HtmlFileResolver = (
  ctx: IndexHtmlTransformContext,
  options: ResolvedPluginOptions,
) => string | null;

const htmlFileResolvers: HtmlFileResolver[] = [
  resolveHtmlFileFromFilename,
  resolveHtmlFileFromPath,
];

function resolveHtmlFileFromFilename(ctx: IndexHtmlTransformContext): string | null {
  if (!("filename" in ctx)) {
    return null;
  }
  if (typeof ctx.filename !== "string" || ctx.filename.length === 0) {
    return null;
  }
  return ctx.filename;
}

function resolveHtmlFileFromPath(
  ctx: IndexHtmlTransformContext,
  options: ResolvedPluginOptions,
): string | null {
  if (!("path" in ctx) || typeof ctx.path !== "string") {
    return null;
  }
  const normalizedRequestPath = ctx.path.replace(/^\/+/, "");
  return path.resolve(options.srcRoot, normalizedRequestPath || "index.html");
}

interface EntryScanQueueItem {
  directory: string;
  relativeDirectory: string;
}

function collectThemeTemplateEntries(options: ResolvedPluginOptions): Record<string, string> {
  const entries: Record<string, string> = {};
  const scanQueue: EntryScanQueueItem[] = [{ directory: options.srcRoot, relativeDirectory: "" }];

  while (scanQueue.length > 0) {
    const current = scanQueue.shift();
    if (!current) {
      continue;
    }

    let items;
    try {
      items = readdirSync(current.directory, { withFileTypes: true, encoding: "utf8" });
    } catch (error) {
      logEntryScanError(current.directory, error);
      continue;
    }

    for (const item of items) {
      const fullPath = path.resolve(current.directory, item.name);
      const relativePath = current.relativeDirectory
        ? `${current.relativeDirectory}/${item.name}`
        : item.name;

      if (item.isDirectory()) {
        if (shouldSkipEntryDirectory(item.name)) {
          continue;
        }
        scanQueue.push({
          directory: fullPath,
          relativeDirectory: relativePath,
        });
        continue;
      }

      if (!item.isFile() || !isHtmlTemplateFile(item.name)) {
        continue;
      }

      entries[toEntryName(relativePath)] = fullPath;
    }
  }
  return entries;
}

function shouldSkipEntryDirectory(directoryName: string): boolean {
  return directoryName === PARTIALS_DIR;
}

function isHtmlTemplateFile(fileName: string): boolean {
  return fileName.endsWith(HTML_EXTENSION);
}

function toEntryName(relativeHtmlPath: string): string {
  const normalizedPath = relativeHtmlPath.replace(/\\/g, "/");
  const htmlPathWithoutExtension = normalizedPath.slice(0, -HTML_EXTENSION.length);

  if (!htmlPathWithoutExtension.endsWith("/index")) {
    return htmlPathWithoutExtension;
  }

  const directoryEntry = htmlPathWithoutExtension.slice(0, -"/index".length);
  return directoryEntry || "index";
}

function logEntryScanError(directory: string, error: unknown): void {
  console.warn(`${PLUGIN_LOG_PREFIX} Failed to scan template directory: ${directory}`);
  console.error(error);
}
