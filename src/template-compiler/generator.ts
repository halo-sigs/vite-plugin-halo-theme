import type { AstNode, RootNode } from "./types";

export function generateTemplate(root: RootNode): string {
  return root.children.map((node) => generateNode(node)).join("");
}

function generateNode(node: AstNode): string {
  if (node.type === "text" || node.type === "comment" || node.type === "doctype") {
    return node.value;
  }

  if (node.selfClosing || node.rawCloseTag === null) {
    return node.rawOpenTag;
  }

  return `${node.rawOpenTag}${node.children.map((child) => generateNode(child)).join("")}${node.rawCloseTag}`;
}
