# Futures Gainers/Losers Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a fixed card in the boards area showing Binance USDT-perp 24h top 10 gainers and top 10 losers, auto-refreshing every 30 seconds.

**Architecture:** Pure frontend change in `index.html`. A new `refreshFutures()` method fetches `https://fapi.binance.com/fapi/v1/ticker/24hr`, filters USDT symbols, sorts by `priceChangePercent`, and stores top/bottom 10. The card renders alongside existing group boards.

**Tech Stack:** Alpine.js 3, DaisyUI 5, Tailwind CSS 4, Binance Futures REST API (public, no key needed)

---

### Task 1: Add Alpine.js state fields for futures data

**Files:**
- Modify: `index.html:725-733` (inside `Alpine.data("tokenPanel", () => ({`)

**Context:**
The `tokenPanel` component state object starts at line 713. New state fields should be inserted after existing fields (around line 733, after `confirmDeleteModal`).

Current state at line 733:
```js
          confirmDeleteModal: { groupId: null },
```

**Step 1: Add futures state fields after `confirmDeleteModal`**

In `index.html`, after line 733 (`confirmDeleteModal: { groupId: null },`), add:

```js
          futuresGainers: [],
          futuresLosers: [],
          futuresLoading: false,
          futuresError: '',
          futuresUpdatedAt: null,
```

**Step 2: Verify the edit looks correct**

Open `index.html` around line 733–740 and confirm the new fields appear before the `async init()` method at line 735.

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): add futures state fields to tokenPanel"
```

---

### Task 2: Add `binanceApi` helper and `refreshFutures()` method

**Files:**
- Modify: `index.html` — two locations:
  1. After `coingeckoApi` block (around line 688) — add `binanceApi`
  2. After `refreshPrices()` method (around line 800) — add `refreshFutures()`

**Step 1: Add `binanceApi` helper after the `coingeckoApi` block (after line 688)**

```js
      // --- Binance Futures API ---
      const binanceApi = {
        getFutures24hTicker() {
          return fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')
            .then((r) => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.json();
            })
            .then((data) => {
              const usdt = data
                .filter((t) => t.symbol.endsWith('USDT'))
                .map((t) => ({
                  symbol: t.symbol.replace('USDT', ''),
                  change: parseFloat(t.priceChangePercent),
                  price: parseFloat(t.lastPrice),
                }));
              usdt.sort((a, b) => b.change - a.change);
              return {
                gainers: usdt.slice(0, 10),
                losers: usdt.slice(-10).reverse(),
              };
            });
        },
      };
```

**Step 2: Add `refreshFutures()` method inside `tokenPanel` after `refreshPrices()` (around line 800)**

```js
          async refreshFutures() {
            this.futuresLoading = true;
            this.futuresError = '';
            try {
              const { gainers, losers } = await binanceApi.getFutures24hTicker();
              this.futuresGainers = gainers;
              this.futuresLosers = losers;
              this.futuresUpdatedAt = new Date();
            } catch (e) {
              this.futuresError = e?.message || '合约数据加载失败';
            } finally {
              this.futuresLoading = false;
            }
          },
```

**Step 3: Verify no syntax errors**

Open browser dev console (`npx wrangler dev`, then visit http://localhost:8787). No JS errors should appear on page load.

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat(ui): add binanceApi helper and refreshFutures method"
```

---

### Task 3: Wire `refreshFutures()` into `init()` and the 30-second interval

**Files:**
- Modify: `index.html:735-739` (the `init()` method)

**Context:**
Current `init()` at line 735:
```js
          async init() {
            useDirectApi = this.useDirectApi;
            await this.loadData();
            setInterval(() => this.refreshPrices(), 30 * 1000);
          },
```

**Step 1: Update `init()` to also call and schedule `refreshFutures()`**

Replace the `init()` method body:

```js
          async init() {
            useDirectApi = this.useDirectApi;
            await this.loadData();
            await this.refreshFutures();
            setInterval(() => {
              this.refreshPrices();
              this.refreshFutures();
            }, 30 * 1000);
          },
```

**Step 2: Verify in browser**

Open browser console. After page load, `this.futuresGainers` and `this.futuresLosers` should be arrays of 10 items. Temporarily add to console to confirm: the futures panel data should exist after init.

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): wire refreshFutures into init and 30s interval"
```

---

### Task 4: Add the futures card HTML to the boards area

**Files:**
- Modify: `index.html:448-472` (after the `x-for` groups loop, before the "New group card")

**Context:**
The boards area renders group cards with `x-for="group in groups"` (line 229–448). After the closing `</template>` at line 448, there is the "New group card" button (line 451, inside `x-if="isEditMode"`). Insert the futures card between them.

**Step 1: Insert the futures card HTML after line 448 (`</template>` closing the x-for loop)**

```html
        <!-- Futures Gainers/Losers Card -->
        <div class="card bg-base-100 shadow w-full sm:w-80 flex-shrink-0">
          <div class="card-body p-4 gap-3">
            <!-- Header -->
            <div class="flex items-center justify-between">
              <h2 class="font-bold text-base">合约涨跌幅榜</h2>
              <span x-show="futuresLoading" class="loading loading-spinner loading-xs"></span>
            </div>

            <!-- Error -->
            <template x-if="futuresError && !futuresLoading">
              <p class="text-xs text-error/70" x-text="futuresError"></p>
            </template>

            <!-- Loading skeleton (first load only) -->
            <template x-if="futuresLoading && futuresGainers.length === 0">
              <div class="flex flex-col gap-2">
                <template x-for="i in 5" :key="i">
                  <div class="skeleton h-5 w-full rounded"></div>
                </template>
              </div>
            </template>

            <!-- Gainers -->
            <template x-if="futuresGainers.length > 0">
              <div class="flex flex-col gap-0">
                <div class="text-[10px] font-semibold text-success/70 uppercase tracking-wide px-1 pb-1">涨幅榜</div>
                <template x-for="(item, idx) in futuresGainers" :key="item.symbol">
                  <a
                    :href="'https://www.binance.com/futures/' + item.symbol + 'USDT'"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="grid grid-cols-[1.2rem_1fr_3.5rem_4rem] gap-x-2 items-center px-1 py-1.5 rounded-lg hover:bg-base-200 transition-colors"
                  >
                    <span class="text-[10px] text-base-content/35 text-right tabular-nums" x-text="idx + 1"></span>
                    <span class="text-xs font-semibold truncate" x-text="item.symbol"></span>
                    <span class="text-xs text-success font-mono tabular-nums text-right" x-text="'+' + item.change.toFixed(2) + '%'"></span>
                    <span class="text-xs font-mono tabular-nums text-right text-base-content/60" x-text="item.price >= 1 ? '$' + item.price.toLocaleString('en-US', {maximumFractionDigits: 2}) : '$' + item.price.toPrecision(4)"></span>
                  </a>
                </template>
              </div>
            </template>

            <!-- Losers -->
            <template x-if="futuresLosers.length > 0">
              <div class="flex flex-col gap-0">
                <div class="text-[10px] font-semibold text-error/70 uppercase tracking-wide px-1 pb-1 border-t border-base-300 pt-2">跌幅榜</div>
                <template x-for="(item, idx) in futuresLosers" :key="item.symbol">
                  <a
                    :href="'https://www.binance.com/futures/' + item.symbol + 'USDT'"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="grid grid-cols-[1.2rem_1fr_3.5rem_4rem] gap-x-2 items-center px-1 py-1.5 rounded-lg hover:bg-base-200 transition-colors"
                  >
                    <span class="text-[10px] text-base-content/35 text-right tabular-nums" x-text="idx + 1"></span>
                    <span class="text-xs font-semibold truncate" x-text="item.symbol"></span>
                    <span class="text-xs text-error font-mono tabular-nums text-right" x-text="item.change.toFixed(2) + '%'"></span>
                    <span class="text-xs font-mono tabular-nums text-right text-base-content/60" x-text="item.price >= 1 ? '$' + item.price.toLocaleString('en-US', {maximumFractionDigits: 2}) : '$' + item.price.toPrecision(4)"></span>
                  </a>
                </template>
              </div>
            </template>

            <!-- Updated at -->
            <template x-if="futuresUpdatedAt">
              <div class="text-[10px] text-base-content/30 text-right">
                更新于 <span x-text="dayjs(futuresUpdatedAt).format('HH:mm:ss')"></span>
              </div>
            </template>
          </div>
        </div>
```

**Step 2: Verify in browser**

Visit http://localhost:8787. The card should appear alongside existing group boards, showing a spinner briefly then rendering gainers/losers lists. Rows should link to Binance futures.

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): add futures gainers/losers card to boards area"
```

---

### Task 5: Final check and build

**Step 1: Run local dev server and do full manual verification**

```bash
npx wrangler dev
```

Verify:
- [ ] Card appears at the end of boards (alongside group cards, same width)
- [ ] Shows spinner on first load
- [ ] Shows 10 gainers with green percentages
- [ ] Shows 10 losers with red percentages
- [ ] Each row is clickable → opens Binance futures page in new tab
- [ ] "更新于 HH:mm:ss" footer updates every 30 seconds
- [ ] No JS errors in browser console
- [ ] Card remains visible in edit mode (it has no edit controls, that's correct)

**Step 2: Build**

```bash
npm run build
```

Verify build succeeds with no errors.

**Step 3: Final commit if any fixups needed**

```bash
git add index.html
git commit -m "fix(ui): futures panel fixups from manual verification"
```
