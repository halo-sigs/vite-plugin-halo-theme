import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { name as packageName } from "../../package.json";
import { generateTemplate } from "./generator";
import { parseTemplate } from "./parser";
import type {
  AstNode,
  CompilerOptions,
  ElementNode,
  RenderContext,
  RootNode,
  SlotMap,
} from "./types";

const DEFAULT_SLOT_NAME = "default";
const PARTIALS_DIR = "partials";
const TEMPLATE_LOG_PREFIX = `[${packageName}]`;

export function compileTemplate(html: string, context: RenderContext): string {
  const root = parseTemplate(html);
  root.children = transformNodes(root.children, context);
  return generateTemplate(root);
}

export function createRenderContext(input: {
  options: CompilerOptions;
  currentFile: string;
  stack?: string[];
}): RenderContext {
  return {
    options: input.options,
    currentFile: input.currentFile,
    stack: input.stack ?? [input.currentFile],
  };
}

function transformNodes(nodes: AstNode[], context: RenderContext): AstNode[] {
  const output: AstNode[] = [];

  for (const node of nodes) {
    if (node.type !== "element") {
      output.push(node);
      continue;
    }

    if (node.tagName === "include") {
      output.push(...expandInclude(node, context));
      continue;
    }

    node.children = transformNodes(node.children, context);
    output.push(node);
  }

  return output;
}

function expandInclude(node: ElementNode, context: RenderContext): AstNode[] {
  const attributes = toAttributeMap(node.attributes);
  const rawSource = attributes.src;

  if (!rawSource) {
    return [createErrorTextNode("<!-- Partial error: missing src attribute -->", node)];
  }

  const fullPath = resolvePartialPath(rawSource, context);
  if (!fullPath) {
    return [createErrorTextNode(`<!-- Partial error: Could not load ${rawSource} -->`, node)];
  }

  if (context.stack.includes(fullPath)) {
    console.error(
      `${TEMPLATE_LOG_PREFIX} Circular partial include detected: ${[...context.stack, fullPath].join(" -> ")}`,
    );
    return [createErrorTextNode(`<!-- Partial error: Circular include ${rawSource} -->`, node)];
  }

  try {
    let content = readFileSync(fullPath, "utf-8");
    const props = { ...attributes };
    delete props.src;

    content = interpolateProps(content, props);

    const partialRoot = parseTemplate(content);
    const slots = extractSlots(node.children);

    applySlots(partialRoot, slots);

    const childContext: RenderContext = {
      options: context.options,
      currentFile: fullPath,
      stack: [...context.stack, fullPath],
    };
    partialRoot.children = transformNodes(partialRoot.children, childContext);

    return partialRoot.children;
  } catch (error) {
    logTemplateError("Error reading partial", context.currentFile, node, String(error));
    return [createErrorTextNode(`<!-- Partial error: Could not load ${rawSource} -->`, node)];
  }
}

function extractSlots(includeChildren: AstNode[]): SlotMap {
  const namedNodes: Record<string, AstNode[]> = {};
  const defaultNodes = cloneNodes(includeChildren);
  const templateMatches = removeNamedTemplateNodes(defaultNodes, namedNodes);

  if (!templateMatches) {
    return {
      defaultNodes,
      namedNodes,
    };
  }

  return {
    defaultNodes,
    namedNodes,
  };
}

function removeNamedTemplateNodes(
  nodes: AstNode[],
  namedNodes: Record<string, AstNode[]>,
): boolean {
  let hasTemplateMatch = false;
  let index = 0;

  while (index < nodes.length) {
    const node = nodes[index];
    if (node?.type !== "element") {
      index += 1;
      continue;
    }

    if (node.tagName === "include") {
      index += 1;
      continue;
    }

    if (node.tagName === "template") {
      hasTemplateMatch = true;
      const attrs = toAttributeMap(node.attributes);
      const slotName = attrs.name;

      if (slotName) {
        namedNodes[slotName] = cloneNodes(node.children);
        nodes.splice(index, 1);
        continue;
      }

      index += 1;
      continue;
    }

    if (node.children.length > 0) {
      const nestedMatched = removeNamedTemplateNodes(node.children, namedNodes);
      hasTemplateMatch ||= nestedMatched;
    }

    index += 1;
  }

  return hasTemplateMatch;
}

function applySlots(root: RootNode, slots: SlotMap): void {
  root.children = replaceSlotNodes(root.children, slots);
}

function replaceSlotNodes(nodes: AstNode[], slots: SlotMap): AstNode[] {
  const output: AstNode[] = [];
  const hasDefaultContent = serializeNodes(slots.defaultNodes).trim().length > 0;

  for (const node of nodes) {
    if (node.type !== "element") {
      output.push(node);
      continue;
    }

    if (node.tagName === "slot") {
      const attrs = toAttributeMap(node.attributes);
      const slotName = attrs.name ?? DEFAULT_SLOT_NAME;

      if (slotName === DEFAULT_SLOT_NAME) {
        const replacement = hasDefaultContent ? slots.defaultNodes : node.children;
        output.push(...cloneNodes(replacement));
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(slots.namedNodes, slotName)) {
        output.push(...cloneNodes(slots.namedNodes[slotName] ?? []));
        continue;
      }

      output.push(...cloneNodes(node.children));
      continue;
    }

    node.children = replaceSlotNodes(node.children, slots);
    output.push(node);
  }

  return output;
}

function resolvePartialPath(rawSource: string, context: RenderContext): string | null {
  const normalizedSource = rawSource.replace(/\\/g, "/");
  const candidates = new Set<string>();

  if (normalizedSource.startsWith("./") || normalizedSource.startsWith("../")) {
    candidates.add(path.resolve(path.dirname(context.currentFile), normalizedSource));
  } else if (normalizedSource.startsWith("/")) {
    candidates.add(path.resolve(context.options.srcRoot, normalizedSource.slice(1)));
  } else {
    candidates.add(path.resolve(context.options.partialsRoot, normalizedSource));

    if (normalizedSource.startsWith(`${PARTIALS_DIR}/`)) {
      candidates.add(path.resolve(context.options.srcRoot, normalizedSource));
    } else {
      candidates.add(path.resolve(path.dirname(context.currentFile), normalizedSource));
    }
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  console.error(`${TEMPLATE_LOG_PREFIX} Partial not found: ${rawSource}`);
  return null;
}

function interpolateProps(content: string, props: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => props[key] ?? "");
}

function toAttributeMap(attributes: { name: string; value: string }[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const attribute of attributes) {
    map[attribute.name] = attribute.value;
  }
  return map;
}

function createErrorTextNode(message: string, baseNode: ElementNode): AstNode {
  return {
    type: "text",
    value: message,
    loc: baseNode.loc,
  };
}

function cloneNodes(nodes: AstNode[]): AstNode[] {
  return nodes.map((node) => cloneNode(node));
}

function cloneNode(node: AstNode): AstNode {
  if (node.type !== "element") {
    return {
      ...node,
      loc: { ...node.loc, start: { ...node.loc.start }, end: { ...node.loc.end } },
    };
  }

  return {
    ...node,
    attributes: node.attributes.map((attribute) => ({ ...attribute })),
    children: node.children.map((child) => cloneNode(child)),
    loc: {
      ...node.loc,
      start: { ...node.loc.start },
      end: { ...node.loc.end },
    },
  };
}

function serializeNodes(nodes: AstNode[]): string {
  return generateTemplate({
    type: "root",
    loc: {
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 0, line: 1, column: 1 },
    },
    children: nodes,
  });
}

function logTemplateError(
  message: string,
  sourceFile: string,
  includeNode: ElementNode,
  detail: string,
): void {
  const line = includeNode.loc.start.line;
  const column = includeNode.loc.start.column;
  console.error(`${TEMPLATE_LOG_PREFIX} ${message} at ${sourceFile}:${line}:${column}`);
  console.error(`${TEMPLATE_LOG_PREFIX} ${detail}`);
}
