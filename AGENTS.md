# Developer & Agent Guidelines (LLM-Friendly)

> AI Agent 在生成、修改、审查本目录代码时，必须遵守本规范。

## 0. 规则优先级（冲突处理）

1. 硬性禁令（禁止项）
2. MUST（必须）
3. SHOULD（建议）
4. 示例代码与说明文字（仅参考）

如规则冲突，按上面顺序执行。

---

## 1. 硬性禁令（MUST NOT）

- 禁止使用 ES Modules（`type="module"`、`import/export`）。
- 禁止引入构建流程（如 Vite/Webpack、本地打包产物、`node_modules` 依赖运行时）。
- 禁止创建独立 `.css` 文件。
- 禁止在页面内自实现 Toast；只能调用 `shared.js` 的 `toast()`。
- 禁止"读操作"使用全局 Toast（详见术语定义）。
- 禁止从零创建新页面；必须以 `template.html` 复制为起点。
- 禁止直接修改 `template.html`（除非用户明确要求）。

---

## 2. 术语定义（机器可判定）

- **读操作（Read）**：获取/查询数据，不改变服务端状态（GET/查询类接口）。
- **写操作（Write）**：创建/修改/删除，会改变服务端状态（POST/PUT/PATCH/DELETE）。
- **接近 1000 行**：`<script>` 内 JS 行数 `>= 800`。
- **局部失败**：页面局部模块请求失败，非整页崩溃。

---

## 3. 技术与加载规则（MUST）

- 依赖通过 CDN 引入，无本地构建步骤。建议使用 `https://cdn.jsdelivr.net`，主版本号即可。
- 标准栈：[Tailwind CSS (Play CDN)](https://tailwindcss.com) + [DaisyUI](https://daisyui.com) + [Alpine.js](https://alpinejs.dev) + [Axios](https://axios-http.com) + [Iconify](https://iconify.design) + [Day.js](https://day.js.org)。
- 遇到交互需求时优先查找 [Alpine 官方插件](https://alpinejs.dev/plugins)（如 `@alpinejs/mask` 处理输入掩码），插件必须在主库之前引入。
- 引入顺序：DaisyUI CSS → Tailwind → Alpine 插件 → Alpine 主库 → 其他库 → `shared.js`。
- 所有页面逻辑放在 `document.addEventListener('alpine:init', ...)` 中初始化。
- 所有自研 API 接口请求必须使用 `axios`，并设置 `timeout: 60000`（60 秒）；必须使用 `try...catch` 并维护 `loading` 状态。
- 若第三方 SDK 强制要求原生 `fetch`，可按其文档使用，但需在代码中注明原因与文档来源。

---

## 4. 逻辑归属决策表（MUST）

| 逻辑类型                 | 放置位置                |
| ------------------------ | ----------------------- |
| 仅当前页面 UI 状态与交互 | 当前 HTML 的 `<script>` |
| API 实例、接口封装       | `shared.js`             |
| 全局常量、通用工具函数   | `shared.js`             |
| 被 2+ 页面复用的逻辑     | `shared.js`             |

API 封装标准模式（in `shared.js`）：

```js
const userApi = {
  getList: (params) => api.get("/users", { params }),
  create: (data) => api.post("/users", data),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`),
};
```

页面调用边界（MUST）：

- 允许：在页面内调用 `userApi.getList()` / `userApi.create()` / `userApi.update()` / `userApi.remove()`。
- 禁止：在页面内直接写 `axios.get(...)` / `axios.post(...)` / `axios.put(...)` / `axios.patch(...)` / `axios.delete(...)`。

---

## 5. 交互反馈规则（MUST）

- **读操作**：
  - 初始加载：使用 `skeleton` 或 `loading-spinner`。
  - 失败：使用内联 `alert-error` + 重试按钮。
  - 不得使用全局 Toast。
- **写操作**：
  - 成功/失败反馈统一调用 `toast()`。
  - 提交按钮必须有 loading 态并 `disabled`。
- **弹窗（Modal）**：
  - 使用 DaisyUI `<dialog>` + Alpine `x-ref`，不使用全局 ID。
  - 打开：`@click="$refs.myModal.showModal()"`，关闭：`<form method="dialog">`。

---

## 6. 命名规范（SHOULD）

- Alpine 组件名：`[feature]Page`（如 `indexPage`、`chatPage`）。
- 布尔状态：`is/has/show` 前缀（如 `isLoading`、`showModal`）。
- 交互函数：`handle/toggle` 前缀（如 `handleSubmit()`、`toggleSidebar()`）。
- 请求函数：`fetch/submit` 前缀（如 `fetchUserList()`）。
- 全局常量：`SNAKE_CASE`（如 `BASE_URL`、`MAX_RETRY_COUNT`）。
- 图标：`<iconify-icon icon="lucide:icon-name"></iconify-icon>`，优先使用项目内已出现图标名。

---

## 7. 项目结构（MUST）

```text
/project-root
├── template.html    # 新页面模板（禁止直接修改）
├── index.html       # 页面
├── shared.js        # API 封装、全局常量、公共 Utils
└── assets/          # 本地图片/字体等静态资源
```

- **template.html**：包含标准 CDN 引入顺序、Toast 容器、Modal 示例和 Alpine.js 骨架代码。

---

## 8. AI 执行检查清单（提交前逐项通过）

- [ ] 新页面是否基于 `template.html` 创建。
- [ ] JS 是否在 `alpine:init` 内初始化。
- [ ] API 封装是否都在 `shared.js`。
- [ ] 页面内是否未直接调用 `axios.*(...)`（应改为调用 `shared.js` 中的 API 封装）。
- [ ] `<script>` JS 是否 `< 1000` 行；若 `>= 800` 是否已评估抽离。
- [ ] 读操作是否未使用全局 Toast。
- [ ] 写操作是否统一调用 `toast()` 且按钮有 loading + disabled。
