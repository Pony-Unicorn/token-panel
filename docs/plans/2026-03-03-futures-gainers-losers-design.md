# 币安合约涨跌幅榜面板设计

**日期**：2026-03-03

## 需求

在现有 Token Panel 看板旁添加一张固定的「合约涨跌幅榜」卡片，展示币安 USDT 永续合约 24 小时涨幅 Top 10 和跌幅 Top 10，每 30 秒自动刷新。

## 技术选型

- **数据源**：Binance Futures 公开 API（无需 API key，支持 CORS）
  - `GET https://fapi.binance.com/fapi/v1/ticker/24hr`
- **过滤条件**：`symbol.endsWith('USDT')`（USDT 永续合约）
- **排序逻辑**：按 `priceChangePercent` 降序取前 10（涨幅榜），升序取前 10（跌幅榜）
- **刷新频率**：与现有 `refreshPrices()` 同步，每 30 秒一次
- **实现方式**：纯前端，只改动 `index.html`，无需修改 Worker

## UI 设计

卡片放在现有 group 看板右侧，尺寸相同（`w-full sm:w-80`），分两个区块：

```
┌─────────────────────────┐
│ 合约涨跌幅榜  [spinner] │
├─────────────────────────┤
│ 涨幅榜                  │
│  1  DOGE  +15.23%  0.38 │
│  2  SOL   +12.10%  142  │
│  ...                    │
├─────────────────────────┤
│ 跌幅榜                  │
│  1  XRP    -8.50%  2.10 │
│  ...                    │
├─────────────────────────┤
│         更新于 12:34:56 │
└─────────────────────────┘
```

### 行字段

| 列 | 内容 |
|----|------|
| 排名 | `#1` … `#10` |
| 币名 | 去掉 USDT 后缀，如 `DOGE` |
| 涨跌幅 | `priceChangePercent`，绿色（涨）/ 红色（跌） |
| 价格 | `lastPrice`，右对齐 |

点击行跳转：`https://www.binance.com/futures/XXXUSDT`

## 数据层变更（Alpine.js）

在 `tokenPanel` data 增加字段：

```js
futuresGainers: [],   // [{symbol, name, change, price}, ...]
futuresLosers: [],
futuresLoading: false,
futuresError: '',
futuresUpdatedAt: null,
```

新增方法 `refreshFutures()`：
1. 设 `futuresLoading = true`
2. `fetch('https://fapi.binance.com/fapi/v1/ticker/24hr')`
3. 过滤 USDT 结尾的 symbol
4. 按 `priceChangePercent` 排序，取前 10（涨）和后 10（跌）
5. 赋值并记录 `futuresUpdatedAt`

在 `init()` 中调用 `refreshFutures()`，并加入现有 `setInterval(30s)` 循环。

## 不在范围内

- 时间周期切换（仅 24h）
- 涨跌幅榜内容的持久化或自定义
- Worker 代理缓存
