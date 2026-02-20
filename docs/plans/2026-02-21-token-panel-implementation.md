# Token Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Trello-style crypto price dashboard on Cloudflare Workers + KV with a simple Alpine.js + DaisyUI frontend.

**Architecture:** Worker handles 3 API endpoints (`GET/PUT /api/groups`, `GET /api/prices`); static frontend served via Cloudflare Assets from `dist/`; KV stores groups config and caches prices (5-min TTL). Auth deferred to Cloudflare Access.

**Tech Stack:** Cloudflare Workers, Cloudflare KV, Alpine.js 3, DaisyUI 5, Tailwind CSS 4, Axios, Iconify, livecoinwatch API.

---

## Task 1: Update wrangler.jsonc

**Files:**
- Modify: `wrangler.jsonc`

**Step 1: Replace wrangler.jsonc with Worker entry + KV binding**

```jsonc
{
  "name": "token-panel",
  "compatibility_date": "2026-01-19",
  "main": "worker.js",
  "assets": {
    "directory": "./dist"
  },
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "REPLACE_WITH_YOUR_KV_NAMESPACE_ID",
      "preview_id": "REPLACE_WITH_YOUR_KV_PREVIEW_ID"
    }
  ]
}
```

**Step 2: Create KV namespace (run once)**

```bash
npx wrangler kv namespace create TOKEN_PANEL
npx wrangler kv namespace create TOKEN_PANEL --preview
```

Copy the output IDs into `wrangler.jsonc` to replace the placeholder strings.

**Step 3: Set the livecoinwatch API key secret**

```bash
npx wrangler secret put LCW_API_KEY
# Paste your API key when prompted
```

Get a free API key at https://livecoinwatch.com/tools/api

**Step 4: Commit**

```bash
git add wrangler.jsonc
git commit -m "chore: add Worker entry and KV binding to wrangler config"
```

---

## Task 2: Create worker.js

**Files:**
- Create: `worker.js`

**Step 1: Write worker.js**

```js
const PRICE_CACHE_TTL = 300; // seconds (5 minutes)

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const method = request.method;

    // GET /api/groups
    if (pathname === "/api/groups" && method === "GET") {
      const groups = (await env.KV.get("groups", "json")) ?? [];
      return json(groups);
    }

    // PUT /api/groups — full replace
    if (pathname === "/api/groups" && method === "PUT") {
      const groups = await request.json();
      await env.KV.put("groups", JSON.stringify(groups));
      await env.KV.delete("prices_cache"); // invalidate so next fetch is fresh
      return json({ ok: true });
    }

    // GET /api/prices
    if (pathname === "/api/prices" && method === "GET") {
      const groups = (await env.KV.get("groups", "json")) ?? [];
      const coins = [...new Set(groups.flatMap((g) => g.coins))];

      if (coins.length === 0) {
        return json({ updatedAt: Date.now(), data: {} });
      }

      // Return cache if still fresh
      const cache = await env.KV.get("prices_cache", "json");
      if (cache && Date.now() - cache.updatedAt < PRICE_CACHE_TTL * 1000) {
        return json(cache);
      }

      // Fetch from livecoinwatch
      const lcwRes = await fetch("https://api.livecoinwatch.com/coins/map", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.LCW_API_KEY,
        },
        body: JSON.stringify({
          codes: coins,
          currency: "USD",
          sort: "rank",
          order: "ascending",
          offset: 0,
          limit: coins.length,
          meta: false,
        }),
      });

      if (!lcwRes.ok) {
        // Return stale cache rather than failing hard
        if (cache) return json(cache);
        return json({ error: "Failed to fetch prices" }, 502);
      }

      const lcwData = await lcwRes.json();
      const data = {};
      for (const coin of lcwData) {
        data[coin.code] = {
          price: coin.rate,
          delta_24h: coin.delta.day, // decimal, e.g. 0.023 = +2.3%
          market_cap: coin.cap,
        };
      }

      const result = { updatedAt: Date.now(), data };
      await env.KV.put("prices_cache", JSON.stringify(result));
      return json(result);
    }

    // All other requests → serve static assets from dist/
    return env.ASSETS.fetch(request);
  },
};
```

**Step 2: Smoke test locally**

```bash
npx wrangler dev
```

```bash
# In another terminal
curl http://localhost:8787/api/groups
# Expected: []

curl -X PUT http://localhost:8787/api/groups \
  -H "Content-Type: application/json" \
  -d '[{"id":"test-1","name":"持仓","coins":["BTC","ETH"]}]'
# Expected: {"ok":true}

curl http://localhost:8787/api/groups
# Expected: [{"id":"test-1","name":"持仓","coins":["BTC","ETH"]}]
```

Note: `/api/prices` will fail locally without a real `LCW_API_KEY`. Set it temporarily in `.dev.vars`:
```
LCW_API_KEY=your_key_here
```
(Add `.dev.vars` to `.gitignore` if not already there.)

**Step 3: Commit**

```bash
git add worker.js
git commit -m "feat: add Cloudflare Worker with groups and prices API"
```

---

## Task 3: Update shared.js

**Files:**
- Modify: `shared.js`

**Step 1: Replace shared.js content**

Replace the entire file:

```js
// shared.js

// 1. Axios instance (same-origin API calls)
const api = axios.create({ timeout: 30000 });

// 2. API definitions
const groupApi = {
  getAll: () => api.get("/api/groups").then((r) => r.data),
  update: (groups) => api.put("/api/groups", groups).then((r) => r.data),
};

const priceApi = {
  getAll: () => api.get("/api/prices").then((r) => r.data),
};

// 3. Alpine Store (Toast)
const TOAST_MAX = 5;

document.addEventListener("alpine:init", () => {
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
});

// 4. Global utils
const toast = (msg, type) => Alpine.store("toast").show(msg, type);
```

**Step 2: Commit**

```bash
git add shared.js
git commit -m "refactor: replace placeholder API with token panel API methods"
```

---

## Task 4: Create index.html

**Files:**
- Create: `index.html`

**Step 1: Write index.html**

```html
<!doctype html>
<html lang="zh-CN" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Token Panel</title>

    <!-- DaisyUI -->
    <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
    <link href="https://cdn.jsdelivr.net/npm/daisyui@5/themes.css" rel="stylesheet" type="text/css" />

    <!-- Tailwind -->
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>

    <!-- Alpine.js -->
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.15.8/dist/cdn.min.js"></script>

    <!-- Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/iconify-icon@3.0.0/dist/iconify-icon.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.19/dayjs.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios@1.13.5/dist/axios.min.js"></script>

    <!-- Shared -->
    <script src="./shared.js"></script>
  </head>
  <body class="min-h-screen bg-base-200">
    <div x-data="tokenPanel">

      <!-- Navbar -->
      <div class="navbar bg-base-100 shadow-sm px-6 sticky top-0 z-10">
        <div class="flex-1 gap-3">
          <span class="text-xl font-bold">Token Panel</span>
          <span x-show="lastUpdatedText" x-text="lastUpdatedText"
                class="text-xs text-base-content/40"></span>
        </div>
        <div class="flex-none">
          <button class="btn btn-primary btn-sm" @click="openNewGroup()">
            <iconify-icon icon="mdi:plus" width="16"></iconify-icon>
            新建看板
          </button>
        </div>
      </div>

      <!-- Boards -->
      <div class="flex gap-4 p-6 overflow-x-auto items-start min-h-[calc(100vh-64px)]">

        <!-- Loading -->
        <template x-if="isLoading && groups.length === 0">
          <div class="flex items-center justify-center w-full h-64">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        </template>

        <!-- Empty state -->
        <template x-if="!isLoading && groups.length === 0">
          <div class="flex flex-col items-center justify-center w-full h-64 gap-3 text-base-content/40">
            <iconify-icon icon="mdi:view-dashboard-outline" width="48"></iconify-icon>
            <p>还没有看板，点击右上角新建看板开始</p>
          </div>
        </template>

        <!-- Board columns -->
        <template x-for="group in groups" :key="group.id">
          <div class="card bg-base-100 shadow w-72 flex-shrink-0">
            <div class="card-body p-4 gap-3">

              <!-- Board header -->
              <div class="flex items-center justify-between">
                <h2 class="font-bold text-base truncate" x-text="group.name"></h2>
                <div class="flex gap-1 flex-shrink-0">
                  <button class="btn btn-ghost btn-xs" @click="openEditGroup(group)"
                          title="重命名">
                    <iconify-icon icon="mdi:pencil-outline" width="14"></iconify-icon>
                  </button>
                  <button class="btn btn-ghost btn-xs text-error" @click="deleteGroup(group.id)"
                          title="删除看板">
                    <iconify-icon icon="mdi:delete-outline" width="14"></iconify-icon>
                  </button>
                </div>
              </div>

              <!-- Token cards -->
              <div class="flex flex-col gap-2">
                <template x-for="coin in group.coins" :key="coin">
                  <div class="bg-base-200 rounded-xl p-3 relative group/card">
                    <button
                      class="btn btn-ghost btn-xs absolute top-1 right-1 opacity-0 group-hover/card:opacity-100 transition-opacity"
                      @click="removeCoin(group.id, coin)" title="移除">
                      <iconify-icon icon="mdi:close" width="12"></iconify-icon>
                    </button>

                    <div class="font-bold text-sm mb-1" x-text="coin"></div>

                    <template x-if="prices[coin]">
                      <div>
                        <div class="text-lg font-mono font-semibold"
                             x-text="formatPrice(prices[coin].price)"></div>
                        <div class="flex items-center justify-between text-xs mt-1">
                          <span :class="deltaClass(prices[coin].delta_24h)"
                                x-text="formatDelta(prices[coin].delta_24h)"></span>
                          <span class="text-base-content/50"
                                x-text="formatMarketCap(prices[coin].market_cap)"></span>
                        </div>
                      </div>
                    </template>
                    <template x-if="!prices[coin]">
                      <div class="text-xs text-base-content/30">暂无数据</div>
                    </template>
                  </div>
                </template>
              </div>

              <!-- Add coin -->
              <button class="btn btn-ghost btn-sm w-full text-base-content/50"
                      @click="openAddCoin(group.id)">
                <iconify-icon icon="mdi:plus" width="16"></iconify-icon>
                添加代币
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- Group modal (new / edit) -->
      <dialog x-ref="groupModal" class="modal">
        <div class="modal-box">
          <h3 class="text-lg font-bold mb-4"
              x-text="groupModal.isEdit ? '修改看板名称' : '新建看板'"></h3>
          <input type="text" class="input input-bordered w-full"
                 placeholder="看板名称"
                 x-model="groupModal.name"
                 @keydown.enter="confirmGroup()" />
          <div class="modal-action">
            <button class="btn btn-ghost"
                    @click="$refs.groupModal.close()">取消</button>
            <button class="btn btn-primary" @click="confirmGroup()">确认</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <!-- Add coin modal -->
      <dialog x-ref="coinModal" class="modal">
        <div class="modal-box">
          <h3 class="text-lg font-bold mb-4">添加代币</h3>
          <input type="text" class="input input-bordered w-full"
                 placeholder="代币符号，如 BTC、ETH、SOL"
                 x-model="coinModal.symbol"
                 @keydown.enter="confirmCoin()" />
          <div class="modal-action">
            <button class="btn btn-ghost"
                    @click="$refs.coinModal.close()">取消</button>
            <button class="btn btn-primary" @click="confirmCoin()">确认</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <!-- Toast -->
      <div class="toast toast-top toast-center z-50">
        <template x-for="t in $store.toast.items" :key="t.id">
          <div x-transition :class="'alert alert-' + t.type">
            <span x-text="t.message"></span>
          </div>
        </template>
      </div>
    </div>

    <script>
      document.addEventListener("alpine:init", () => {
        Alpine.data("tokenPanel", () => ({
          groups: [],
          prices: {},
          lastUpdated: null,
          isLoading: false,

          groupModal: { isEdit: false, id: null, name: "" },
          coinModal: { groupId: null, symbol: "" },

          async init() {
            await this.loadData();
            setInterval(() => this.refreshPrices(), 5 * 60 * 1000);
          },

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

          async refreshPrices() {
            try {
              const priceResult = await priceApi.getAll();
              this.prices = priceResult.data;
              this.lastUpdated = priceResult.updatedAt
                ? new Date(priceResult.updatedAt)
                : null;
            } catch (e) {
              toast("价格更新失败", "error");
            }
          },

          async saveGroups() {
            await groupApi.update(this.groups);
          },

          // --- Group actions ---

          openNewGroup() {
            this.groupModal = { isEdit: false, id: null, name: "" };
            this.$refs.groupModal.showModal();
          },

          openEditGroup(group) {
            this.groupModal = { isEdit: true, id: group.id, name: group.name };
            this.$refs.groupModal.showModal();
          },

          async confirmGroup() {
            const name = this.groupModal.name.trim();
            if (!name) return;
            if (this.groupModal.isEdit) {
              const g = this.groups.find((g) => g.id === this.groupModal.id);
              if (g) g.name = name;
            } else {
              this.groups.push({
                id: crypto.randomUUID(),
                name,
                coins: [],
              });
            }
            this.$refs.groupModal.close();
            await this.saveGroups();
          },

          async deleteGroup(id) {
            if (!confirm("确认删除该看板？")) return;
            this.groups = this.groups.filter((g) => g.id !== id);
            await this.saveGroups();
          },

          // --- Coin actions ---

          openAddCoin(groupId) {
            this.coinModal = { groupId, symbol: "" };
            this.$refs.coinModal.showModal();
          },

          async confirmCoin() {
            const symbol = this.coinModal.symbol.trim().toUpperCase();
            if (!symbol) return;
            const g = this.groups.find((g) => g.id === this.coinModal.groupId);
            if (g && !g.coins.includes(symbol)) {
              g.coins.push(symbol);
              this.$refs.coinModal.close();
              await this.saveGroups();
              await this.refreshPrices();
            } else {
              this.$refs.coinModal.close();
            }
          },

          async removeCoin(groupId, symbol) {
            const g = this.groups.find((g) => g.id === groupId);
            if (!g) return;
            g.coins = g.coins.filter((c) => c !== symbol);
            await this.saveGroups();
          },

          // --- Formatting ---

          formatPrice(price) {
            if (price >= 1) {
              return (
                "$" +
                price.toLocaleString("en-US", { maximumFractionDigits: 2 })
              );
            }
            return "$" + price.toPrecision(4);
          },

          formatDelta(delta) {
            const pct = (delta * 100).toFixed(2);
            return (delta >= 0 ? "+" : "") + pct + "%";
          },

          deltaClass(delta) {
            return delta >= 0 ? "text-success" : "text-error";
          },

          formatMarketCap(cap) {
            if (!cap) return "—";
            if (cap >= 1e12) return (cap / 1e12).toFixed(2) + "T";
            if (cap >= 1e9) return (cap / 1e9).toFixed(2) + "B";
            if (cap >= 1e6) return (cap / 1e6).toFixed(2) + "M";
            return cap.toLocaleString("en-US");
          },

          get lastUpdatedText() {
            if (!this.lastUpdated) return "";
            return (
              "更新于 " +
              dayjs(this.lastUpdated).format("HH:mm:ss")
            );
          },
        }));
      });
    </script>
  </body>
</html>
```

**Step 2: Build and verify**

```bash
npm run build
# Expected output: build complete, shows index.html and shared.js sizes
ls dist/
# Expected: index.html  shared.js
```

**Step 3: Verify in browser via wrangler dev**

```bash
npx wrangler dev
# Open http://localhost:8787
# Expected: empty state with "还没有看板" message
# Click "新建看板", enter a name, save → board column appears
# Click "添加代币", enter "BTC", save → coin card appears (price shows if LCW_API_KEY is set in .dev.vars)
```

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add token panel frontend SPA"
```

---

## Task 5: Update build.js to exclude worker.js

**Files:**
- Modify: `build.js:47-49`

**Step 1: Add worker.js to the JS exclusion list**

Find this line in `build.js`:
```js
const jsFiles = allFiles.filter(
  (f) => f.endsWith(".js") && f !== "build.js",
);
```

Replace with:
```js
const jsFiles = allFiles.filter(
  (f) => f.endsWith(".js") && f !== "build.js" && f !== "worker.js",
);
```

**Step 2: Verify build excludes worker.js**

```bash
npm run build
ls dist/
# Expected: index.html  shared.js   (no worker.js)
```

**Step 3: Commit**

```bash
git add build.js
git commit -m "chore: exclude worker.js from frontend build output"
```

---

## Task 6: Update docs/Overview.md

**Files:**
- Modify: `docs/Overview.md`

**Step 1: Replace Overview.md with polished version**

```markdown
# Token Panel

类似 Trello 的加密币价格看板，基于 Cloudflare Workers + KV 实现。

## 功能

- 多个自定义看板，每个看板可添加任意代币
- 每个代币展示实时价格、24h 涨跌幅、市值
- 价格数据每 5 分钟自动刷新（由后端缓存，减少 API 调用）
- 所有配置持久化在 Cloudflare KV

## 技术栈

| 层级 | 技术 |
|------|------|
| 托管 | Cloudflare Workers + Assets |
| 存储 | Cloudflare KV |
| 价格数据 | [livecoinwatch API](https://livecoinwatch.github.io/lcw-api-docs/#coinsmap) |
| 前端 | Alpine.js 3 + DaisyUI 5 + Tailwind CSS 4 |
| 构建 | Node.js (terser + html-minifier-terser) |

## 本地开发

1. 安装依赖：`npm install`
2. 创建 KV namespace（首次）：见 `docs/plans/2026-02-21-token-panel-implementation.md` Task 1
3. 设置 livecoinwatch API key：在 `.dev.vars` 写入 `LCW_API_KEY=your_key`
4. 启动本地开发服务器：`npx wrangler dev`
5. 访问 http://localhost:8787

## 构建与部署

```bash
npm run build          # 生成 dist/
npx wrangler deploy    # 部署到 Cloudflare
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/groups | 获取所有看板组 |
| PUT | /api/groups | 全量更新看板组 |
| GET | /api/prices | 获取所有已追踪代币的实时价格 |

## 设计文档

见 `docs/plans/2026-02-21-token-panel-design.md`
```

**Step 2: Commit**

```bash
git add docs/Overview.md
git commit -m "docs: update overview with setup instructions and API reference"
```

---

## Deployment Checklist

After all tasks are complete:

1. `wrangler.jsonc` has real KV namespace IDs
2. `LCW_API_KEY` secret is set via `wrangler secret put`
3. `npm run build` succeeds and `dist/` contains `index.html` + `shared.js`
4. `npx wrangler deploy` succeeds
5. (Optional) Set up Cloudflare Access to protect the deployed URL
