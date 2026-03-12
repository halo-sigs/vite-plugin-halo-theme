import type {
  AstNode,
  AttributeNode,
  ElementNode,
  RootNode,
  SourcePosition,
  SourceRange,
} from "./types";

interface OpenElementState {
  tagName: string;
  rawOpenTag: string;
  attributes: AttributeNode[];
  selfClosing: boolean;
  startOffset: number;
  openTagEndOffset: number;
  children: AstNode[];
}

export function parseTemplate(input: string): RootNode {
  const root: RootNode = {
    type: "root",
    loc: createRange(input, 0, input.length),
    children: [],
  };

  const stack: OpenElementState[] = [];
  let cursor = 0;

  const pushNode = (node: AstNode): void => {
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
      return;
    }
    root.children.push(node);
  };

  while (cursor < input.length) {
    if (input.startsWith("<!--", cursor)) {
      const endIndex = input.indexOf("-->", cursor + 4);
      const end = endIndex === -1 ? input.length : endIndex + 3;
      pushNode({
        type: "comment",
        value: input.slice(cursor, end),
        loc: createRange(input, cursor, end),
      });
      cursor = end;
      continue;
    }

    if (input[cursor] === "<") {
      if (input.startsWith("</", cursor)) {
        const closeTagEnd = findTagEnd(input, cursor);
        if (closeTagEnd === -1) {
          pushNode({
            type: "text",
            value: input.slice(cursor),
            loc: createRange(input, cursor, input.length),
          });
          break;
        }

        const rawCloseTag = input.slice(cursor, closeTagEnd + 1);
        const closeTagName = readCloseTagName(rawCloseTag);
        const open = closeTopMatchingElement(stack, closeTagName);

        if (!open) {
          pushNode({
            type: "text",
            value: rawCloseTag,
            loc: createRange(input, cursor, closeTagEnd + 1),
          });
          cursor = closeTagEnd + 1;
          continue;
        }

        const elementNode: ElementNode = {
          type: "element",
          tagName: open.tagName,
          rawOpenTag: open.rawOpenTag,
          rawCloseTag,
          attributes: open.attributes,
          children: open.children,
          selfClosing: false,
          loc: createRange(input, open.startOffset, closeTagEnd + 1),
        };
        pushNode(elementNode);
        cursor = closeTagEnd + 1;
        continue;
      }

      if (looksLikeDoctype(input, cursor)) {
        const doctypeEnd = findTagEnd(input, cursor);
        const end = doctypeEnd === -1 ? input.length : doctypeEnd + 1;
        pushNode({
          type: "doctype",
          value: input.slice(cursor, end),
          loc: createRange(input, cursor, end),
        });
        cursor = end;
        continue;
      }

      const openTagEnd = findTagEnd(input, cursor);
      if (openTagEnd === -1) {
        pushNode({
          type: "text",
          value: input.slice(cursor),
          loc: createRange(input, cursor, input.length),
        });
        break;
      }

      const rawOpenTag = input.slice(cursor, openTagEnd + 1);
      const parsedTag = parseOpenTag(rawOpenTag);
      if (!parsedTag) {
        pushNode({
          type: "text",
          value: rawOpenTag,
          loc: createRange(input, cursor, openTagEnd + 1),
        });
        cursor = openTagEnd + 1;
        continue;
      }

      if (parsedTag.selfClosing) {
        pushNode({
          type: "element",
          tagName: parsedTag.tagName,
          rawOpenTag,
          rawCloseTag: null,
          attributes: parsedTag.attributes,
          children: [],
          selfClosing: true,
          loc: createRange(input, cursor, openTagEnd + 1),
        });
        cursor = openTagEnd + 1;
        continue;
      }

      stack.push({
        tagName: parsedTag.tagName,
        rawOpenTag,
        attributes: parsedTag.attributes,
        selfClosing: false,
        startOffset: cursor,
        openTagEndOffset: openTagEnd + 1,
        children: [],
      });
      cursor = openTagEnd + 1;
      continue;
    }

    const nextTagStart = input.indexOf("<", cursor);
    const textEnd = nextTagStart === -1 ? input.length : nextTagStart;
    pushNode({
      type: "text",
      value: input.slice(cursor, textEnd),
      loc: createRange(input, cursor, textEnd),
    });
    cursor = textEnd;
  }

  while (stack.length > 0) {
    const open = stack.pop();
    if (!open) {
      continue;
    }
    const node: ElementNode = {
      type: "element",
      tagName: open.tagName,
      rawOpenTag: open.rawOpenTag,
      rawCloseTag: null,
      attributes: open.attributes,
      children: open.children,
      selfClosing: false,
      loc: createRange(input, open.startOffset, open.openTagEndOffset),
    };
    pushNode(node);
  }

  return root;
}

function parseOpenTag(
  openTag: string,
): { tagName: string; attributes: AttributeNode[]; selfClosing: boolean } | null {
  const inner = openTag.slice(1, openTag.endsWith("/>") ? -2 : -1).trim();
  if (inner.length === 0 || inner.startsWith("/")) {
    return null;
  }

  const [rawTagName, ...restParts] = inner.split(/\s+/);
  if (!rawTagName) {
    return null;
  }

  const tagName = rawTagName.toLowerCase();
  const attrSource = restParts.length > 0 ? inner.slice(rawTagName.length).trim() : "";

  return {
    tagName,
    attributes: parseAttributes(attrSource),
    selfClosing: /\/\s*>$/.test(openTag),
  };
}

function parseAttributes(attrSource: string): AttributeNode[] {
  const attributes: AttributeNode[] = [];
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(attrSource)) !== null) {
    const [, name, doubleQuotedValue, singleQuotedValue] = match;
    attributes.push({
      name,
      value: doubleQuotedValue ?? singleQuotedValue ?? "",
    });
  }

  return attributes;
}

function readCloseTagName(rawCloseTag: string): string {
  const match = /^<\/\s*([^\s>]+)\s*>$/.exec(rawCloseTag);
  return match?.[1]?.toLowerCase() ?? "";
}

function closeTopMatchingElement(
  stack: OpenElementState[],
  closeTagName: string,
): OpenElementState | null {
  if (closeTagName.length === 0) {
    return null;
  }

  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index]?.tagName !== closeTagName) {
      continue;
    }

    const [matched] = stack.splice(index, 1);
    return matched ?? null;
  }

  return null;
}

function findTagEnd(input: string, start: number): number {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = start; index < input.length; index += 1) {
    const char = input[index];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ">" && !inSingleQuote && !inDoubleQuote) {
      return index;
    }
  }

  return -1;
}

function looksLikeDoctype(input: string, start: number): boolean {
  return /^<!doctype\b/i.test(input.slice(start, start + 10));
}

function createRange(input: string, startOffset: number, endOffset: number): SourceRange {
  return {
    start: offsetToPosition(input, startOffset),
    end: offsetToPosition(input, endOffset),
  };
}

function offsetToPosition(input: string, offset: number): SourcePosition {
  let line = 1;
  let column = 1;
  const end = Math.max(0, Math.min(offset, input.length));

  for (let index = 0; index < end; index += 1) {
    if (input[index] === "\n") {
      line += 1;
      column = 1;
      continue;
    }
    column += 1;
  }

  return {
    offset: end,
    line,
    column,
  };
}
