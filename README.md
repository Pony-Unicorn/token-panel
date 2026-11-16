# Swift: Astro + AlpineJS Template

> 基于 **Astro** + **Alpine.js** + **Tailwind CSS v4** + **daisyUI v5** 构建的极速、轻量、高可维护性 Web 全栈起手式模版。
>
> 核心原则：**简单的保持简单，复杂的合理拆分**。Astro 负责页面骨架与 SEO，Alpine.js 负责轻量声明式交互。

---

## 🚀 快速上手

> 环境要求：Node.js `>= 22.23.4`，推荐使用 `pnpm` 包管理器。

### 1. 创建项目

```bash
pnpm dlx degit Pony-Unicorn/alpinejs-template my-project

cd my-project

pnpm install
```

### 2. 常用开发命令

```bash
# 启动本地开发服务 (默认端口 4321)
pnpm dev

# 生产环境打包构建
pnpm build

# 本地预览打包产物
pnpm preview

# 代码格式化与修复
pnpm format:fix
```

> 💡 启动服务后，欢迎访问 **`http://localhost:4321/demo`** 查看内置的交互实验室（已预置全局 Toast、输入掩码、ky API 客户端、HTML5 原生 Dialog 弹窗等实用范例）。

---

## 🛠️ 开发规范

### 1. Alpine.js 交互规范

- **简单交互**：直接使用 HTML 内联 Alpine 指令（如 `x-data`, `x-show`, `x-text` 等）。
- **复杂交互**：使用 `Alpine.data()` 抽离组件逻辑，便于复用与维护。
- **公用工具与扩展**：在 `src/scripts/alpine.ts` 中通过 `Alpine.plugin()`、`Alpine.magic()` 统一注册。

### 2. 全局状态与内置能力

- **局部状态**：使用组件或元素自身的 `x-data`。
- **全局共享状态**：使用 `Alpine.store()`，所有全局 Store 在 `src/scripts/alpine.ts` 统一注册。
- **开箱即用能力**（无需手动 import，模板已全局注入）：
  - **全局 Toast 消息通知**：`$store.toasts.success('操作成功')` / `error()` / `warning()` / `info()`
  - **网络请求客户端**：`$api('users').json()`（基于 [ky](https://github.com/sindresorhus/ky) 封装，已配置基础实例）
  - **通用工具函数**：`$utils.dayjs`、`$utils.copyToClipboard('文本')`、`$utils.sleep(1000)`
  - **输入掩码**：已全局集成官方 `@alpinejs/mask` 插件，直接在 input 标签上添加 `x-mask="99/99/9999"` 等指令

### 3. 命名规范

- **Astro 组件**：PascalCase，例如 `Navbar.astro`、`Footer.astro`。
- **TS/JS 模块**：kebab-case，例如 `toaster.ts`、`api.ts`。

### 4. 代码组织

- `components/`、`layouts/`、`pages/` 仅存放 Astro 模板文件。
- 所有 TypeScript 代码统一存放在 `src/scripts/` 目录下：
  - `src/scripts/components/`：存放复杂组件配套的交互逻辑（按组件名命名）。
  - `src/scripts/lib/`：通用工具、API 实例与底层封装。
  - `src/scripts/alpine.ts`：Alpine.js 插件、Store 与 Magic 全局注册入口。
- **按需扩展**：简单组件不必创建配套 TS 文件，避免过度抽象；后续项目变大时，可按需在 `scripts/` 下扩展 `pages/`（页面专属交互）、`i18n/`（国际化配置）或 `constants.ts` 等。

---

## 📂 目录结构

```text
src/
├── components/          # Astro 组件
│   ├── Navbar.astro     # 顶部导航
│   ├── Footer.astro     # 页面底部
│   └── Toaster.astro    # 全局 Toast 容器
│
├── layouts/             # Astro 布局
│   └── Layout.astro     # 基础主布局 (含 SEO 与 Meta 配置)
│
├── pages/               # 页面路由
│   ├── index.astro      # 首页
│   ├── about.astro      # 关于页
│   └── demo.astro       # Alpine.js 交互实验室 (丰富范例演示)
│
├── scripts/             # TypeScript 逻辑代码
│   ├── alpine.ts        # Alpine 全局入口 (Store / Magic / 插件注册)
│   ├── components/      # 组件配套逻辑
│   │   └── toaster.ts   # Toast 状态管理器
│   │
│   └── lib/             # 通用工具模块
│       ├── api.ts       # ky 网络请求实例
│       └── utils.ts     # Day.js 与常用工具方法
│   # 💡 说明：复杂业务可在此目录下按需扩展 pages/、i18n/ 等模块
│
├── images/              # 图片资源 (png, jpeg, webp)
├── icons/               # 矢量图标资源 (svg)
├── app.css              # 全局样式入口 (Tailwind CSS v4 + daisyUI v5)
└── env.d.ts             # 类型声明文件
```

---

## 🌟 推荐与精选库

### 内置核心技术栈

- **UI & 样式**：[Tailwind CSS v4](https://tailwindcss.com/) + [daisyUI v5](https://daisyui.com/)
- **图标集成**：[astro-icon](https://github.com/natemoo-re/astro-icon)，内置采用 [Ionicons (@iconify-json/ion)](https://icon-sets.iconify.design/ion)
- **网络请求**：[ky](https://github.com/sindresorhus/ky)（轻量优雅的现代 Fetch 包装库）
- **时间与日期**：[Day.js](https://day.js.org/)
- **SEO 优化**：[astro-seo](https://github.com/jonasmerlin/astro-seo)

### 后续开发精选推荐（按需引入）

- **富文本与排版**：[@tailwindcss/typography](https://github.com/tailwindlabs/tailwindcss-typography) - 适用于博客、文章、文档等场景的纯净排版插件。
- **更多图标集**：可随时通过 `@iconify-json/*` 配合 `astro-icon` 无缝引入任意开源图标集（如 Lucide、Tabler、Heroicons 等）。

---

### Recommend MCP

**必须安装**

- Context7: 实时获取文档 https://github.com/upstash/context7
- exa: 联网搜索与网页内容阅读 https://exa.ai/docs/reference/exa-mcp
- grep: 查询公共 GitHub https://vercel.com/blog/grep-a-million-github-repositories-via-mcp

---

## 📋 todo list
