# index.html 合规重构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修改 `index.html` 使其完全通过 AGENTS.md 全部检查项，最小改动原则。

**Architecture:** 单文件交付，所有逻辑内联在同一 HTML 的 `<script>` 中，依赖通过 CDN 引入，图标使用内联 SVG。无构建步骤，无外部 JS 文件，无 iconify 运行时。

**Tech Stack:** DaisyUI 5 + Tailwind CSS 4 (Browser) + Alpine.js 3.15.8 + Day.js 1.11.19，全部来自 cdn.jsdelivr.net。

---

## 背景与现状

`index.html` 当前违反 AGENTS.md 的项：

| 违规 | 位置 |
|------|------|
| `<script src="./shared.js">` | `<head>` 末尾 |
| `<script src="iconify-icon">` | `<head>` |
| `<script src="axios">` | `<head>` |
| `daisyui@5/themes.css` 重复引入 | `<head>` |
| `<iconify-icon icon="mdi:plus">` | 新建看板按钮（navbar） |
| `<iconify-icon icon="mdi:view-dashboard-outline">` | 空状态插图 |
| `<iconify-icon icon="mdi:pencil-outline">` | 重命名按钮 |
| `<iconify-icon icon="mdi:delete-outline">` | 删除看板按钮 |
| `<iconify-icon icon="mdi:close">` | 移除代币按钮 |
| `<iconify-icon icon="mdi:plus">` | 添加代币按钮 |
| `groupApi` / `priceApi` 调用 axios | 来自 shared.js |
| `toast()` 全局函数 | 来自 shared.js |

**不改动：** `worker.js`、`template.html`、所有 Alpine 组件状态与业务方法、HTML 结构与 Tailwind 类名。

---

## Task 1：修正 `<head>` — 删除违规 CDN，调整加载顺序

**Files:**
- Modify: `index.html`（`<head>` 内，第 1–25 行左右）

**Step 1：定位并替换 `<head>` 内容**

将 `<head>` 整段替换为如下内容（严格按 AGENTS.md 顺序）：

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Token Panel</title>

  <!-- 1. DaisyUI CSS -->
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />

  <!-- 2. Tailwind -->
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>

  <!-- 3. Alpine.js（无插件） -->
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.15.8/dist/cdn.min.js"></script>

  <!-- 4. 其他库 -->
  <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.19/dayjs.min.js"></script>
</head>
```

删除项：
- `daisyui@5/themes.css` 行
- `iconify-icon@3.0.0` 行
- `axios@1.13.5` 行
- `<script src="./shared.js">` 行

**Step 2：验证文件不再包含违规引用**

用编辑器搜索以下字符串，确认结果为零：
- `iconify-icon.min.js`
- `axios`
- `shared.js`
- `themes.css`

**Step 3：Commit**

```bash
git add index.html
git commit -m "refactor: fix head CDN order, remove iconify/axios/shared.js refs"
```

---

## Task 2：内联 shared.js — API helpers + Toast store（原生 fetch）

**Files:**
- Modify: `index.html`（`<script>` 块顶部）

**Step 1：在 `<script>` 块最顶部添加内联代码**

在 `document.addEventListener("alpine:init", () => {` **之前**插入：

```js
// --- API helpers (native fetch, replaces shared.js + axios) ---
const groupApi = {
  getAll() {
    return fetch("/api/groups").then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
  },
  update(groups) {
    return fetch("/api/groups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(groups),
    }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
  },
};

const priceApi = {
  getAll() {
    return fetch("/api/prices").then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
  },
};

const toast = (msg, type) => Alpine.store("toast").show(msg, type);
```

**Step 2：将 Alpine.store("toast") 注册移入 alpine:init 内**

在 `alpine:init` 回调开头（`Alpine.data("tokenPanel", ...)` 之前）插入：

```js
const TOAST_MAX = 5;
Alpine.store("toast", {
  items: [],
  show(msg, type = "success") {
    const id = Date.now();
    this.items.push({ id, message: msg, type });
    if (this.items.length > TOAST_MAX) this.items.shift();
    setTimeout(() => {
      this.items = this.items.filter((t) => t.id !== id);
    }, 3000);
  },
});
```

注意：原 `shared.js` 中这段代码已在自己的 `alpine:init` 监听内，现在合并进同一个监听即可。

**Step 3：验证 `<script>` 内没有 `axios` 引用**

搜索 `axios`，确认结果为零。

**Step 4：Commit**

```bash
git add index.html
git commit -m "refactor: inline groupApi/priceApi/toast with native fetch"
```

---

## Task 3：替换所有 `<iconify-icon>` → 内联 SVG

**Files:**
- Modify: `index.html`（HTML body，6 处图标）

所有 SVG 使用 Lucide 风格：`fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`

---

### 3-A：新建看板按钮（navbar，`mdi:plus` w-4）

**原代码：**
```html
<iconify-icon icon="mdi:plus" width="16"></iconify-icon>
```

**替换为：**
```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4" aria-hidden="true">
  <line x1="12" y1="5" x2="12" y2="19"></line>
  <line x1="5" y1="12" x2="19" y2="12"></line>
</svg>
```

---

### 3-B：空状态插图（`mdi:view-dashboard-outline` w-12）

**原代码：**
```html
<iconify-icon icon="mdi:view-dashboard-outline" width="48"></iconify-icon>
```

**替换为：**
```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-12 h-12" aria-hidden="true">
  <rect width="7" height="7" x="3" y="3" rx="1"></rect>
  <rect width="7" height="7" x="14" y="3" rx="1"></rect>
  <rect width="7" height="7" x="14" y="14" rx="1"></rect>
  <rect width="7" height="7" x="3" y="14" rx="1"></rect>
</svg>
```

（stroke-width 用 1.5 让大图标更轻盈，与视觉风格一致）

---

### 3-C：重命名按钮（`mdi:pencil-outline` w-3.5）

**原代码：**
```html
<iconify-icon icon="mdi:pencil-outline" width="14"></iconify-icon>
```

**替换为：**
```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5" aria-hidden="true">
  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
  <path d="m15 5 4 4"></path>
</svg>
```

---

### 3-D：删除看板按钮（`mdi:delete-outline` w-3.5）

**原代码：**
```html
<iconify-icon icon="mdi:delete-outline" width="14"></iconify-icon>
```

**替换为：**
```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5" aria-hidden="true">
  <path d="M3 6h18"></path>
  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
  <line x1="10" y1="11" x2="10" y2="17"></line>
  <line x1="14" y1="11" x2="14" y2="17"></line>
</svg>
```

---

### 3-E：移除代币按钮（`mdi:close` w-3）

**原代码：**
```html
<iconify-icon icon="mdi:close" width="12"></iconify-icon>
```

**替换为：**
```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3" aria-hidden="true">
  <path d="M18 6 6 18"></path>
  <path d="m6 6 12 12"></path>
</svg>
```

---

### 3-F：添加代币按钮（`mdi:plus` w-4，同 3-A）

**原代码：**
```html
<iconify-icon icon="mdi:plus" width="16"></iconify-icon>
```

**替换为（与 3-A 完全相同）：**
```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4" aria-hidden="true">
  <line x1="12" y1="5" x2="12" y2="19"></line>
  <line x1="5" y1="12" x2="19" y2="12"></line>
</svg>
```

---

**Step 7：验证页面内不再含 `iconify-icon`**

搜索 `iconify-icon`，确认结果为零。

**Step 8：Commit**

```bash
git add index.html
git commit -m "refactor: replace all iconify-icon with inline SVG (Lucide)"
```

---

## Task 4：最终验证（AGENTS.md 检查清单）

**Step 1：逐项检查**

打开 `index.html`，对照以下清单逐一确认（全部为 ✅ 才算完成）：

- [ ] 仅一个 HTML 文件，无额外 JS/CSS 文件依赖（shared.js 已删）
- [ ] 所有 JS 在 `<script>` 中，无 `import/export`
- [ ] 无 `<iconify-icon>`，图标均为内联 `<svg>`
- [ ] JS 初始化在 `alpine:init` 内
- [ ] API 请求全部使用原生 `fetch`，无 axios
- [ ] 读操作（loadData/refreshPrices）有 loading 态（`isLoading`）与错误提示（toast）
- [ ] 写操作（confirmGroup / confirmCoin / removeCoin / deleteGroup）调用 `saveGroups()` 后有 toast 反馈
- [ ] CDN 顺序：DaisyUI → Tailwind → Alpine → Day.js

**Step 2：浏览器快速冒烟测试（可选，有本地服务器时执行）**

```bash
npx wrangler dev
# 访问 http://localhost:8787
# 检查：页面正常渲染，图标显示，新建/删除看板功能正常
```

**Step 3：最终 Commit**

```bash
git add index.html
git commit -m "refactor: index.html fully compliant with AGENTS.md"
```
