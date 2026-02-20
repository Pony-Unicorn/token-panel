# Token Panel — Design Doc

Date: 2026-02-21

## Overview

A Trello-style cryptocurrency price dashboard deployed on Cloudflare Workers. Users can create
multiple named boards, each tracking a custom list of tokens. Price data is fetched from
livecoinwatch and cached in Cloudflare KV.

Authentication is deferred — the app will be protected via Cloudflare Access post-deployment.

---

## Architecture

### Request Flow

```
Browser
  ├── GET /           → Cloudflare Assets → dist/index.html
  ├── GET /shared.js  → Cloudflare Assets → dist/shared.js
  └── /api/*          → worker.js
                           ├── KV: groups config (read/write)
                           └── livecoinwatch API (price cache)
```

### File Structure

```
token-panel/
├── worker.js          # Cloudflare Worker (API + request routing)
├── index.html         # Frontend SPA (Alpine.js + DaisyUI)
├── shared.js          # Frontend shared utilities
├── build.js           # Build script (minifies index.html + shared.js → dist/)
├── wrangler.jsonc     # Cloudflare config (Worker entry + KV binding)
└── dist/              # Build output (served as static assets)
```

---

## Backend (worker.js)

### Configuration

```js
const PRICE_CACHE_TTL = 300; // seconds (5 minutes)
```

### API Endpoints

| Method | Path          | Description                          |
|--------|---------------|--------------------------------------|
| GET    | /api/groups   | Return all boards                    |
| PUT    | /api/groups   | Full replace of all boards           |
| GET    | /api/prices   | Return cached prices for all tracked tokens |

### KV Data Structure

**Key: `groups`**
```json
[
  { "id": "uuid", "name": "持仓", "coins": ["BTC", "ETH"] },
  { "id": "uuid", "name": "关注", "coins": ["SOL", "ASTER"] }
]
```

**Key: `prices_cache`**
```json
{
  "updatedAt": 1708483200000,
  "data": {
    "BTC": { "price": 95000, "delta_24h": 2.3, "market_cap": 1880000000000 },
    "ETH": { "price": 3200, "delta_24h": -1.1, "market_cap": 384000000000 }
  }
}
```

### Price Fetch Logic (`GET /api/prices`)

1. Read `groups` from KV → deduplicate all coin symbols
2. Read `prices_cache` from KV
3. If cache is missing or `now - updatedAt > PRICE_CACHE_TTL * 1000`:
   - Call livecoinwatch `/coins/map` with deduped symbols
   - Write result to `prices_cache` in KV
4. Return `data` map

### Secrets

- `LCW_API_KEY` — injected via `wrangler secret put LCW_API_KEY`, never stored in files

---

## Frontend (index.html)

### Tech Stack

- Alpine.js — reactivity
- DaisyUI 5 + Tailwind CSS 4 — UI components
- Iconify — icons

### UI Layout

```
┌─────────────────────────────────────────────────────┐
│  Token Panel                        [+ 新建看板]     │
├──────────────┬──────────────┬───────────────────────┤
│ 持仓          │ 关注          │                       │
│ [编辑] [删除] │ [编辑] [删除] │                       │
│ ──────────── │ ──────────── │                       │
│ ┌──────────┐ │ ┌──────────┐ │                       │
│ │ BTC      │ │ │ SOL      │ │                       │
│ │ $95,000  │ │ │ $180     │ │                       │
│ │ +2.3%    │ │ │ -0.8%    │ │                       │
│ │ 1.88T    │ │ │        [x]│ │                       │
│ └──────────┘ │ └──────────┘ │                       │
│  [+ 添加代币] │  [+ 添加代币] │                       │
└──────────────┴──────────────┴───────────────────────┘
```

### Interactions

- **+ 新建看板** → modal to input board name → save
- **编辑** → modal to rename board → save
- **删除** → confirm then remove board
- **+ 添加代币** → modal to input token symbol (e.g. `BTC`) → save
- **[x] on token card** → remove token from board
- All mutations call `PUT /api/groups` with full updated array
- Price colors: positive delta = green, negative = red
- Auto-refresh prices every 5 minutes
- Header shows last updated timestamp
