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
