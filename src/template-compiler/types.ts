export interface SourcePosition {
  offset: number;
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export interface BaseNode {
  type: "root" | "element" | "text" | "comment" | "doctype";
  loc: SourceRange;
}

export interface RootNode extends BaseNode {
  type: "root";
  children: AstNode[];
}

export interface AttributeNode {
  name: string;
  value: string;
}

export interface ElementNode extends BaseNode {
  type: "element";
  tagName: string;
  rawOpenTag: string;
  rawCloseTag: string | null;
  attributes: AttributeNode[];
  children: AstNode[];
  selfClosing: boolean;
}

export interface TextNode extends BaseNode {
  type: "text";
  value: string;
}

export interface CommentNode extends BaseNode {
  type: "comment";
  value: string;
}

export interface DoctypeNode extends BaseNode {
  type: "doctype";
  value: string;
}

export type AstNode = ElementNode | TextNode | CommentNode | DoctypeNode;

export interface CompilerOptions {
  srcRoot: string;
  partialsRoot: string;
  debug?: boolean;
}

export interface RenderContext {
  options: CompilerOptions;
  currentFile: string;
  stack: string[];
}

export interface SlotMap {
  defaultNodes: AstNode[];
  namedNodes: Record<string, AstNode[]>;
}
