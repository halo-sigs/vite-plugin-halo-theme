import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { compileTemplate, createRenderContext } from "./compiler";

function writeFile(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

describe("template compiler", () => {
  let tempDir: string;
  let srcRoot: string;
  let partialsRoot: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "halo-template-compiler-"));
    srcRoot = path.join(tempDir, "src");
    partialsRoot = path.join(srcRoot, "partials");
    mkdirSync(srcRoot, { recursive: true });
    mkdirSync(partialsRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function render(html: string, currentFile = path.join(srcRoot, "index.html")): string {
    return compileTemplate(
      html,
      createRenderContext({
        options: { srcRoot, partialsRoot },
        currentFile,
        stack: [currentFile],
      }),
    );
  }

  it("expands include with props, default slot and named slot", () => {
    writeFile(
      path.join(partialsRoot, "layout.html"),
      `
<section class="layout">
  <h1>{{title}}</h1>
  <header><slot name="head"><title>Fallback</title></slot></header>
  <main><slot /></main>
  <footer><slot name="footer"><p>Default footer</p></slot></footer>
</section>
`.trim(),
    );

    const output = render(
      `
<include src="layout.html" title="Home">
  <template name="head"><title>Page title</title></template>
  <article>Body content</article>
</include>
`.trim(),
    );

    expect(output).toContain("<h1>Home</h1>");
    expect(output).toContain("<title>Page title</title>");
    expect(output).toContain("<article>Body content</article>");
    expect(output).toContain("<p>Default footer</p>");
  });

  it("uses fallback content when caller does not provide slot content", () => {
    writeFile(
      path.join(partialsRoot, "card.html"),
      `<section><slot><p>Fallback body</p></slot></section>`,
    );

    const output = render(`<include src="card.html"></include>`);
    expect(output).toContain("<p>Fallback body</p>");
  });

  it("resolves bare partial path from partials directory with highest priority", () => {
    const pageFile = path.join(srcRoot, "pages", "post.html");

    writeFile(path.join(partialsRoot, "card.html"), `<div>From partials</div>`);
    writeFile(path.join(srcRoot, "pages", "card.html"), `<div>From page directory</div>`);

    const output = render(`<include src="card.html"></include>`, pageFile);
    expect(output).toContain("From partials");
    expect(output).not.toContain("From page directory");
  });

  it("resolves relative, root-based, and partials-prefixed include paths", () => {
    const pageFile = path.join(srcRoot, "pages", "post.html");

    writeFile(path.join(srcRoot, "pages", "snippet.html"), `<aside>Relative include</aside>`);
    writeFile(path.join(srcRoot, "shared.html"), `<div>Root include</div>`);
    writeFile(path.join(partialsRoot, "badge.html"), `<span>Partials prefixed</span>`);

    const output = render(
      `
<include src="./snippet.html"></include>
<include src="/shared.html"></include>
<include src="partials/badge.html"></include>
`.trim(),
      pageFile,
    );

    expect(output).toContain("Relative include");
    expect(output).toContain("Root include");
    expect(output).toContain("Partials prefixed");
  });

  it("returns readable error comment for missing src attribute", () => {
    const output = render(`<include></include>`);
    expect(output).toContain("<!-- Partial error: missing src attribute -->");
  });

  it("returns readable error comment for missing partial", () => {
    const output = render(`<include src="not-exist.html"></include>`);
    expect(output).toContain("<!-- Partial error: Could not load not-exist.html -->");
  });

  it("detects circular include and stops recursion", () => {
    writeFile(path.join(partialsRoot, "a.html"), `<include src="b.html"></include>`);
    writeFile(path.join(partialsRoot, "b.html"), `<include src="a.html"></include>`);

    const output = render(`<include src="a.html"></include>`);
    expect(output).toContain("<!-- Partial error: Circular include a.html -->");
  });
});
