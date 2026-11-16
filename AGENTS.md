# Development

## 0. 规则优先级（冲突处理）

1. 硬性禁令（MUST NOT）
2. 必须遵循（MUST）
3. 建议遵循（SHOULD）
4. 示例代码与说明文字（仅参考）

如规则冲突，严格按上述优先级自顶向下执行。

---

## 1. 硬性禁令（MUST NOT）

- **禁止引入重型前端框架**：严禁引入或使用 React、Vue、Svelte、Solid 等重型客户端框架及其组件。
- **禁止引入多余三方库**：严禁自行引入重复功能的第三方库（如 `axios`、`lodash`、外挂 Modal/Toast 库等），必须优先使用项目内置能力。
- **禁止在 `.astro` 组件内手写大段业务脚本**：超过 50 行的复杂业务逻辑、多步算法、跨组件复用逻辑或定时器管理，严禁直接内嵌在 `.astro` 内，必须抽离拆分至 `src/scripts/` 目录（50 行以内的组件私有轻量状态、单接口请求与内联联动允许直接在 `.astro` 内编写）。
- **禁止破坏包管理与构建配置**：
  - 必须使用 `pnpm`，严禁使用 `npm` 或 `yarn`，严禁生成 `package-lock.json` 或 `yarn.lock`。
  - 严禁新建 `tailwind.config.js` / `tailwind.config.mjs`（本项目基于 Tailwind CSS v4，样式统一通过 `@tailwindcss/vite` 与 `src/app.css` 配置）。
- **禁止破坏静态优先原则**：严禁无理由将静态展示内容改为客户端动态渲染。

---

## 2. 核心目标（MUST）

- **动静分离哲学**：Astro 负责 95% 的页面骨架、静态生成与 SEO，Alpine.js 负责 5% 的轻量渐进式交互。
- **简单至上（KISS）**：简单的保持简单，简单的展示与内联交互无需额外封装；复杂的按规范合理拆分。
- **拒绝过度抽象**：严禁为了“架构”而提前设计无用的抽象层、包装类或未被调用的工具函数，无必要不创建新文件。

---

## 3. 技术与加载规则（MUST）

- **开发与构建命令**：
  - 开发服务：启动使用 `pnpm dev`（后台模式使用 `astro dev --background`，管理使用 `astro dev stop|status|logs`）。
  - 打包与预览：使用 `pnpm build` 与 `pnpm preview`。
  - 代码格式化：提交前使用 `pnpm format:fix`。
- **Alpine.js 集中装配**：
  - 所有 Alpine 插件（`Alpine.plugin`）、全局 Store（`Alpine.store`）、全局 Magic 属性（`Alpine.magic`）**必须且只能**在 `src/scripts/alpine.ts` 集中注册。
- **统一内置能力调用**：
  - **网络请求**：必须通过全局注入的 `$api`（基于 ky）发起请求，如 `this.$api('path').json()`，禁止私自 `fetch` 或另行 import ky。
  - **通用工具**：日期时间与常用操作必须优先调用 `$utils`（内置 `dayjs`、`sleep`、`copyToClipboard` 等）。
  - **表单掩码**：格式化规则输入必须直接使用官方 `@alpinejs/mask` 指令（`x-mask`）。

---

## 4. 交互反馈规则（MUST）

- **全局消息通知**：
  - 全局消息提示必须调用 `$store.toasts` 提供的方法（`$store.toasts.success()`、`error()`、`warning()`、`info()`）。
  - 严禁使用浏览器原生 `alert()`、`confirm()` 或临时拼凑悬浮层。
- **弹窗与模态框**：
  - 优先使用 HTML5 原生 `<dialog>` + DaisyUI `modal` 结构，并通过 `$refs.modalName.showModal()` 触发。
  - 原生支持 Top Layer、焦点陷阱（Focus Trap）与 ESC 键退出，避免手写布尔值和遮罩层。
- **异步操作反馈**：
  - 所有涉及异步请求的交互按钮，必须绑定 loading 状态并置灰：`:disabled="loading"`，配合 DaisyUI `<span class="loading loading-spinner">`。
- **防闪烁处理**：
  - 使用 `x-show` 依赖异步或挂载后状态的元素，必须配合添加 `x-cloak` 指令。

---

## 5. 命名规范（SHOULD）

- **Astro 页面与组件**：遵循 `PascalCase`，例如 `Navbar.astro`、`Footer.astro`、`Toaster.astro`。
- **TS/JS 模块与工具文件**：遵循 `kebab-case`，例如 `toaster.ts`、`api.ts`、`utils.ts`。
- **Alpine 状态与方法**：
  - 状态变量与函数推荐使用 `camelCase`（如 `isLoading`, `handleSubmit`）。
  - 组件逻辑函数或工厂函数推荐语义清晰的命名（如 `toastManager`）。
- **样式类名**：优先使用 DaisyUI 5 语义化类名与 Tailwind CSS v4 原生 utility 类，严禁手写冗余内联 CSS 样式。

---

## 6. 项目结构（MUST）

所有新增或修改的文件必须严格按照下列归属存放：

- `src/components/`：可复用的 Astro 页面级与 UI 组件。
- `src/layouts/`：全局或页面骨架布局文件（如 `Layout.astro`）。
- `src/pages/`：基于文件系统的 Astro 页面路由（如 `index.astro`, `about.astro`, `demo.astro`）。
- `src/scripts/`：所有 TypeScript/JavaScript 业务逻辑的唯一收口处：
  - `src/scripts/alpine.ts`：Alpine 入口，统一装配。
  - `src/scripts/components/`：复杂组件配套的状态管理与业务脚本（如 `toaster.ts`）。
  - `src/scripts/lib/`：通用工具、底层 API 客户端等基础模块。
  - `src/scripts/pages/`：（按需扩展）页面独有的复杂交互逻辑。
- `src/icons/`：SVG 矢量图标文件。
- `src/images/`：位图资源（PNG, JPG, WEBP）。
- `public/`：favicon、robots.txt 等无需 Vite 构建处理的纯静态文件。

---

## 7. AI 执行检查清单（提交前逐项通过）

在向用户交付代码或执行文件写入前，AI 必须自检并确保满足以下条件：

- [ ] **是否遵守高压线**：未引入任何重型前端框架（React/Vue 等）及未经批准的第三方库。
- [ ] **是否复用内置能力**：消息提示走 `$store.toasts`、网络请求走 `$api`、工具走 `$utils`、掩码走 `x-mask`，未重复造轮子。
- [ ] **代码分层是否合规**：复杂 TS/JS 是否已移入 `src/scripts/`，未在 `.astro` 内堆砌大段业务代码。
- [ ] **样式是否规范**：严格使用 Tailwind CSS v4 与 DaisyUI 5，未生成或修改旧版 `tailwind.config.js`。
- [ ] **目录与命名是否合规**：文件名与存放路径严格符合项目结构定义。
- [ ] **交互与用户体验**：异步按钮是否包含 loading 态与置灰保护，必要元素是否添加了 `x-cloak`。
