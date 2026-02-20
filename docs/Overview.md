# 类似 Trello 的加密币的价格看板

## 基于 Cloudflare Workers 和 Cloudflare KV 实现

- 配置项提取出一个变量，比如价格的缓存时间等
- KV 中存储 group: [{index:1, name: "持仓", coins:['BTC','ETH']},{index:0, name: "关注",coins:['BTC','SOL','ASTER']}]
- KV 中缓存根据 group的coins去重后在 livecoinwatch中通过/coins/map获取的结果缓存

## 需求

- 前端有多个类似任务看板的价格，每个看板可自定义看板名字，可以自定义添加代币，通过 [livecoinwatch 获取](https://livecoinwatch.github.io/lcw-api-docs/#coinsmap)

## 参考

- livecoinwatch 文档 https://livecoinwatch.github.io/lcw-api-docs/#coinsmap
