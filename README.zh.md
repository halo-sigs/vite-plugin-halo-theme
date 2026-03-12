# @halo-dev/vite-plugin-halo-theme

一个面向 Halo 主题开发的 Vite 插件。

它在 Vite 处理 HTML 之前执行模板预编译，为 Halo 主题提供更轻量的组件复用能力（`include`、`slot`、`props`），并将 `src` 下的 HTML 自动作为多页面入口构建到 `templates`。

## 为什么需要它

Halo 主题通常需要页面片段复用和布局组合能力。
这个插件通过预编译阶段补齐这类能力，降低模板重复，提升主题维护效率。

主要能力：

1. 模板复用能力：支持 include、slot、props 等
2. 自动扫描 `src` 目录，将所有 HTML 作为 Vite 构建入口，并自动处理静态资源引入

## 安装

```bash
pnpm add -D @halo-dev/vite-plugin-halo-theme
```

## 快速开始

在 `vite.config.ts` 中启用插件：

```ts
import { defineConfig } from "vite";
import { haloThemePlugin } from "@halo-dev/vite-plugin-halo-theme";

export default defineConfig({
  plugins: [haloThemePlugin()],
});
```

## 示例项目

可运行示例位于 [`example`](./example)。

```bash
cd example
pnpm install
pnpm build
```

## 目录约定

本插件是 Halo 主题专用，默认约定：

- 页面目录：`src`
- partials 目录：`src/partials`
- 静态资源目录：`public`
- 输出目录：`templates`
- 构建资源目录：`templates/assets`

示例结构：

```text
.
├── public
│   └── ...
├── src
│   ├── js
│   │   ├── index.js
│   │   └── post.js
│   ├── css
│   │   └── index.css
│   ├── index.html           # 页面入口
│   ├── post.html            # 页面入口
│   └── partials             # 模板片段目录（约定）
│       ├── layout.html      # 模板片段
│       └── card.html        # 模板片段
├── theme.yaml
└── templates                # 模板与静态资源输出目录
```

## 入口扫描规则

插件会扫描 `src` 下全部 `.html`，并跳过 `src/partials`。

映射示例：

- `src/index.html` -> `templates/index.html`
- `src/post.html` -> `templates/post.html`

## 模板语法

> 注意：本节语法（`include`、`slot`、`props`）仅在 Vite 构建阶段由插件预编译处理，不是 Thymeleaf 原生语法。  
> 请区分两套处理时机：Vite 编译期（前端构建）与 Thymeleaf 渲染期（后端运行时）。

### Include

```html
<include src="layout.html">
  <main>...</main>
</include>
```

### Props

调用：

```html
<include src="card.html" title="Hello"></include>
```

partial：

```html
<h2>{{title}}</h2>
```

### 默认 Slot

partial：

```html
<slot />
```

### 具名 Slot

partial：

```html
<slot name="head" />
```

调用：

```html
<include src="layout.html">
  <template name="head">
    <title>Page Title</title>
  </template>
  <main>...</main>
</include>
```

## include 路径解析

- `./foo.html` / `../foo.html`：相对当前文件
- `/foo.html`：相对 `src`
- `foo.html`：优先 `src/partials/foo.html`
- `partials/foo.html`：解析为 `src/partials/foo.html`

## 开发命令

```bash
pnpm install
pnpm test
pnpm build
pnpm lint
pnpm fmt
```

## 兼容性与边界

- 当前 parser 为轻量实现，面向插件语法需求，不是完整 HTML5 规范解析器
- `{{prop}}` 为字符串级插值，不执行表达式
- 插件定位为 Halo 主题专用，不追求通用站点模板引擎场景
