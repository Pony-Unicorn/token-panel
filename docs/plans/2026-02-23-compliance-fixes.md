# index.html 合规修复实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复代码审查发现的 4 个 Critical/Important 问题，使 index.html 完全符合 AGENTS.md 交互反馈规则。

**Architecture:** 纯 HTML/JS 单文件，所有改动限定在 index.html 内。Alpine.js 响应式状态驱动 UI 变更，无需引入新依赖。

**Tech Stack:** Alpine.js 3 + DaisyUI 5（已有）。

---

## 问题清单

| # | 严重度 | 问题 | 修复方向 |
|---|--------|------|----------|
| 1 | Critical | 读操作失败只弹 toast，无持久错误块 + 重试按钮 | 添加 `loadError` 状态 + `alert-error` 块 |
| 2 | Critical | 写操作确认按钮无 loading/disabled | 添加 `isSaving` 状态，绑定到按钮 |
| 3 | Important | `saveGroups()` re-throw 造成未处理 rejection | 移除 `throw e` |
| 4 | Important | `deleteGroup` 用 `window.confirm()` | 改用 DaisyUI `<dialog>` |

---

## Task 1：读操作错误处理 — 添加内联错误块 + 重试按钮

**Files:**
- Modify: `index.html`（状态声明约第 352 行，loadData 约第 362 行，boards 区 HTML 约第 66–99 行）

### Step 1：在 Alpine.data 状态对象中添加 `loadError`

找到（约第 348–355 行）：
```js
Alpine.data("tokenPanel", () => ({
  groups: [],
  prices: {},
  lastUpdated: null,
  isLoading: false,

  groupModal: { isEdit: false, id: null, name: "" },
  coinModal: { groupId: null, symbol: "" },
```

替换为：
```js
Alpine.data("tokenPanel", () => ({
  groups: [],
  prices: {},
  lastUpdated: null,
  isLoading: false,
  loadError: "",

  groupModal: { isEdit: false, id: null, name: "" },
  coinModal: { groupId: null, symbol: "" },
```

### Step 2：修改 `loadData()` 的错误处理

找到（约第 362–379 行）：
```js
async loadData() {
  this.isLoading = true;
  try {
    const [groups, priceResult] = await Promise.all([
      groupApi.getAll(),
      priceApi.getAll(),
    ]);
    this.groups = groups;
    this.prices = priceResult.data;
    this.lastUpdated = priceResult.updatedAt
      ? new Date(priceResult.updatedAt)
      : null;
  } catch (e) {
    toast("加载失败", "error");
  } finally {
    this.isLoading = false;
  }
},
```

替换为：
```js
async loadData() {
  this.isLoading = true;
  this.loadError = "";
  try {
    const [groups, priceResult] = await Promise.all([
      groupApi.getAll(),
      priceApi.getAll(),
    ]);
    this.groups = groups;
    this.prices = priceResult.data;
    this.lastUpdated = priceResult.updatedAt
      ? new Date(priceResult.updatedAt)
      : null;
  } catch (e) {
    this.loadError = e?.message || "加载失败，请稍后重试";
  } finally {
    this.isLoading = false;
  }
},
```

### Step 3：在 boards 区添加错误块，修正 empty state 条件

找到（约第 69–99 行）：
```html
        <!-- Loading -->
        <template x-if="isLoading && groups.length === 0">
          <div class="flex items-center justify-center w-full h-64">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        </template>

        <!-- Empty state -->
        <template x-if="!isLoading && groups.length === 0">
```

替换为：
```html
        <!-- Loading -->
        <template x-if="isLoading && groups.length === 0">
          <div class="flex items-center justify-center w-full h-64">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        </template>

        <!-- Load error -->
        <template x-if="!isLoading && loadError">
          <div class="flex items-center justify-center w-full h-64">
            <div class="alert alert-error max-w-sm" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span x-text="loadError"></span>
              <button class="btn btn-sm" @click="loadData()">重试</button>
            </div>
          </div>
        </template>

        <!-- Empty state -->
        <template x-if="!isLoading && !loadError && groups.length === 0">
```

### Step 4：验证

```bash
grep -n "loadError" /Users/pony/workspace/code/own/token-panel/index.html
```

预期：至少 4 行命中（状态声明、loadData 清除、loadData 设置、模板条件）。

### Step 5：Commit

```bash
cd /Users/pony/workspace/code/own/token-panel
git add index.html
git commit -m "fix: add inline load error block with retry button

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2：写操作 — 添加 `isSaving` 状态 + 按钮 loading/disabled

**Files:**
- Modify: `index.html`（状态声明、saveGroups、groupModal 按钮、coinModal 按钮）

### Step 1：在状态对象中添加 `isSaving`

在 `loadError: "",` 后新增一行：

找到：
```js
  loadError: "",

  groupModal: { isEdit: false, id: null, name: "" },
```

替换为：
```js
  loadError: "",
  isSaving: false,

  groupModal: { isEdit: false, id: null, name: "" },
```

### Step 2：修改 `saveGroups()` 管理 `isSaving`

找到（约第 393–401 行）：
```js
async saveGroups() {
  try {
    await groupApi.update(this.groups);
  } catch (e) {
    toast("保存失败，请重试", "error");
    await this.loadData(); // re-sync with server
    throw e;
  }
},
```

替换为：
```js
async saveGroups() {
  this.isSaving = true;
  try {
    await groupApi.update(this.groups);
  } catch (e) {
    toast("保存失败，请重试", "error");
    await this.loadData(); // re-sync with server
  } finally {
    this.isSaving = false;
  }
},
```

注意：同时移除了 `throw e`（解决 Issue 3）。

### Step 3：给 groupModal 确认按钮添加 loading/disabled

找到（约第 254–260 行）：
```html
          <div class="modal-action">
            <button class="btn btn-ghost" @click="$refs.groupModal.close()">
              取消
            </button>
            <button class="btn btn-primary" @click="confirmGroup()">
              确认
            </button>
          </div>
```

替换为：
```html
          <div class="modal-action">
            <button class="btn btn-ghost" :disabled="isSaving" @click="$refs.groupModal.close()">
              取消
            </button>
            <button class="btn btn-primary" :disabled="isSaving" :class="{ 'loading': isSaving }" @click="confirmGroup()">
              确认
            </button>
          </div>
```

### Step 4：给 coinModal 确认按钮添加 loading/disabled

找到（约第 279–284 行）：
```html
          <div class="modal-action">
            <button class="btn btn-ghost" @click="$refs.coinModal.close()">
              取消
            </button>
            <button class="btn btn-primary" @click="confirmCoin()">确认</button>
          </div>
```

替换为：
```html
          <div class="modal-action">
            <button class="btn btn-ghost" :disabled="isSaving" @click="$refs.coinModal.close()">
              取消
            </button>
            <button class="btn btn-primary" :disabled="isSaving" :class="{ 'loading': isSaving }" @click="confirmCoin()">
              确认
            </button>
          </div>
```

### Step 5：验证

```bash
grep -n "isSaving" /Users/pony/workspace/code/own/token-panel/index.html
```

预期：至少 6 行命中（状态声明、saveGroups 设置×2、两个模态框各 2 处绑定）。

### Step 6：Commit

```bash
cd /Users/pony/workspace/code/own/token-panel
git add index.html
git commit -m "fix: add isSaving state with loading/disabled on write buttons, remove saveGroups re-throw

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3：删除确认改用 DaisyUI `<dialog>`

**Files:**
- Modify: `index.html`（状态声明、deleteGroup 按钮 HTML、新增 dialog HTML、JS 方法）

### Step 1：在状态对象中添加 `confirmDeleteModal`

找到：
```js
  groupModal: { isEdit: false, id: null, name: "" },
  coinModal: { groupId: null, symbol: "" },
```

替换为：
```js
  groupModal: { isEdit: false, id: null, name: "" },
  coinModal: { groupId: null, symbol: "" },
  confirmDeleteModal: { groupId: null },
```

### Step 2：将删除按钮的 `@click` 改为打开 modal

找到（约第 134–156 行）：
```html
                  <button
                    class="btn btn-ghost btn-xs text-error"
                    @click="deleteGroup(group.id)"
                    title="删除看板"
                  >
```

替换为：
```html
                  <button
                    class="btn btn-ghost btn-xs text-error"
                    @click="openDeleteGroup(group.id)"
                    title="删除看板"
                  >
```

### Step 3：在 coin modal 之后添加删除确认 dialog

找到（约第 289–291 行，coinModal dialog 结束后）：
```html
      <!-- Toast -->
```

在它之前插入：
```html
      <!-- Delete confirm modal -->
      <dialog x-ref="confirmModal" class="modal">
        <div class="modal-box">
          <h3 class="text-lg font-bold mb-2">删除看板</h3>
          <p class="text-base-content/70 mb-4">确认删除该看板？此操作不可撤销。</p>
          <div class="modal-action">
            <button class="btn btn-ghost" @click="$refs.confirmModal.close()">
              取消
            </button>
            <button class="btn btn-error" :disabled="isSaving" :class="{ 'loading': isSaving }" @click="confirmDelete()">
              删除
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

```

### Step 4：替换 `deleteGroup` 方法，新增 `openDeleteGroup` 和 `confirmDelete`

找到（约第 432–436 行）：
```js
          async deleteGroup(id) {
            if (!confirm("确认删除该看板？")) return;
            this.groups = this.groups.filter((g) => g.id !== id);
            await this.saveGroups();
          },
```

替换为：
```js
          openDeleteGroup(id) {
            this.confirmDeleteModal = { groupId: id };
            this.$refs.confirmModal.showModal();
          },

          async confirmDelete() {
            this.$refs.confirmModal.close();
            this.groups = this.groups.filter(
              (g) => g.id !== this.confirmDeleteModal.groupId,
            );
            await this.saveGroups();
          },
```

### Step 5：验证

```bash
grep -n "confirm\b\|confirmModal\|openDeleteGroup\|confirmDelete\|window\.confirm" /Users/pony/workspace/code/own/token-panel/index.html
```

预期：`window.confirm` 无命中；`confirmModal`、`openDeleteGroup`、`confirmDelete` 均有命中。

### Step 6：Commit

```bash
cd /Users/pony/workspace/code/own/token-panel
git add index.html
git commit -m "fix: replace window.confirm with DaisyUI dialog for delete confirmation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4：最终验证

### Step 1：逐项检查

```bash
# 无 window.confirm
grep -n "window\.confirm\b" /Users/pony/workspace/code/own/token-panel/index.html

# 读操作有错误块
grep -n "loadError\|alert-error\|重试" /Users/pony/workspace/code/own/token-panel/index.html

# 写操作有 isSaving
grep -n "isSaving" /Users/pony/workspace/code/own/token-panel/index.html

# saveGroups 无 throw e
grep -n "throw e" /Users/pony/workspace/code/own/token-panel/index.html

# 三个 dialog 都有 x-ref + showModal + form method="dialog"
grep -n "x-ref.*Modal\|showModal\|method=\"dialog\"" /Users/pony/workspace/code/own/token-panel/index.html
```

全部符合预期后完成。
