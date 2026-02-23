# index.html 合规重构设计

**日期：** 2026-02-23
**目标：** 使 `index.html` 完全符合 AGENTS.md 所有检查项，最小改动原则。

---

## 问题诊断

当前 `index.html` 违反以下 AGENTS.md 硬性禁令：

| 违规项 | 规则 |
|--------|------|
| `<script src="./shared.js">` | 禁止依赖 shared.js 等额外 JS 文件 |
| `<iconify-icon>` 组件（5 处） | 禁止使用 iconify-icon 运行时 |
| `axios` | 应使用原生 fetch |
| CDN 加载顺序错误 | DaisyUI → Tailwind → Alpine → 其他 |
| `daisyui@5/themes.css` 重复引入 | 仅保留主 CSS |

---

## 方案 A：最小改动合规

### 1. `<head>` 修正

删除：
- `daisyui@5/themes.css`（重复）
- `iconify-icon` CDN
- `axios` CDN
- `<script src="./shared.js">`

保留并调整顺序：DaisyUI CSS → Tailwind → Alpine → Day.js

### 2. 内联 shared.js 内容

在 `<script>` 块顶部内联（全部使用原生 fetch）：

```js
const groupApi = {
  getAll: () => fetch("/api/groups").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  update: (groups) => fetch("/api/groups", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(groups) }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
};

const priceApi = {
  getAll: () => fetch("/api/prices").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
};

const toast = (msg, type) => Alpine.store("toast").show(msg, type);
```

`Alpine.store("toast", ...)` 移入 `alpine:init` 回调内。

### 3. 图标替换（内联 SVG，Lucide 风格）

| 位置 | 原图标 | 替换 |
|------|--------|------|
| 新建看板 / 添加代币按钮 | `mdi:plus` | Lucide plus SVG |
| 空状态插图 | `mdi:view-dashboard-outline` | Lucide layout-dashboard SVG |
| 重命名按钮 | `mdi:pencil-outline` | Lucide pencil SVG |
| 删除看板按钮 | `mdi:delete-outline` | Lucide trash-2 SVG |
| 移除代币按钮 | `mdi:close` | Lucide x SVG |

### 4. 不改动范围

- 所有 Alpine 组件状态与业务方法
- HTML 结构与 Tailwind / DaisyUI 类名
- `worker.js`、`template.html`

---

## 验收标准（AGENTS.md 检查清单）

- [ ] 仅产出一个 HTML 文件
- [ ] 所有 JS 在 `<script>` 内，无外部 JS 依赖
- [ ] 无 `<iconify-icon>`，图标为内联 SVG
- [ ] JS 在 `alpine:init` 内初始化
- [ ] API 请求统一使用原生 `fetch`
- [ ] 读操作有 loading 与错误重试
- [ ] 写操作按钮有 loading + disabled
