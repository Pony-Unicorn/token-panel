const KV_GROUP = 'group'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*'
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const { pathname } = new URL(request.url)
    const method = request.method

    const userEmail = request.headers.get('Cf-Access-Authenticated-User-Email')

    // GET /api
    if (pathname === '/api' && method === 'GET') {
      if (!userEmail) {
        return new Response('Missing access authentication.', { status: 401 })
      }

      return new Response(`User Email: ${userEmail}`)
    }

    // GET /api/groups
    if (pathname === '/api/groups' && method === 'GET') {
      const groups = (await env.KV.get(`${KV_GROUP}-${userEmail}`, 'json')) ?? []
      return Response.json(groups, { headers: CORS_HEADERS })
    }

    // PUT /api/groups — full replace
    if (pathname === '/api/groups' && method === 'PUT') {
      let groups
      try {
        groups = await request.json()
      } catch {
        return new Response('Invalid JSON', {
          status: 400,
          headers: CORS_HEADERS
        })
      }
      if (!Array.isArray(groups)) {
        return new Response('Body must be an array.', {
          status: 400,
          headers: CORS_HEADERS
        })
      }
      await env.KV.put(`${KV_GROUP}-${userEmail}`, JSON.stringify(groups))
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    // Proxy /api/v3/* to CoinGecko (GET only, with cf cache)
    if (pathname.startsWith('/api/v3/') && method === 'GET') {
      const url = new URL(request.url)
      const targetUrl = 'https://api.coingecko.com' + url.pathname + url.search
      const origin = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; CloudflareWorker/1.0)'
        },
        cf: {
          cacheEverything: true,
          cacheKey: targetUrl,
          cacheTtlByStatus: { '200-299': 60, '400-499': 0, '500-599': 0 }
        }
      })
      const headers = new Headers(origin.headers)
      Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v))
      return new Response(origin.body, {
        status: origin.status,
        headers
      })
    }

    // GET /api/futures/summary — Binance Futures Gainers & Losers (30s cf cache)
    if (pathname === '/api/futures/summary' && method === 'GET') {
      try {
        let tradingSymbols = null
        try {
          const infoRes = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo', {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (compatible; CloudflareWorker/1.0)'
            },
            cf: {
              cacheEverything: true,
              cacheKey: 'https://fapi.binance.com/fapi/v1/exchangeInfo',
              cacheTtlByStatus: { '200-299': 3600, '400-499': 0, '500-599': 0 }
            }
          })
          if (infoRes.ok) {
            const info = await infoRes.json()
            tradingSymbols = new Set(
              (info.symbols || [])
                .filter((s) => s.status === 'TRADING' && s.symbol && s.symbol.endsWith('USDT'))
                .map((s) => s.symbol)
            )
          }
        } catch {
          // Fallback if exchangeInfo fails
        }

        const binanceRes = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr', {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; CloudflareWorker/1.0)'
          },
          cf: {
            cacheEverything: true,
            cacheKey: 'https://fapi.binance.com/fapi/v1/ticker/24hr',
            cacheTtlByStatus: { '200-299': 30, '400-499': 0, '500-599': 0 }
          }
        })

        if (!binanceRes.ok) {
          return new Response(`Binance API error: ${binanceRes.status}`, {
            status: binanceRes.status,
            headers: CORS_HEADERS
          })
        }

        const data = await binanceRes.json()
        const usdt = data
          .filter((t) =>
            tradingSymbols ? tradingSymbols.has(t.symbol) : t.symbol && t.symbol.endsWith('USDT')
          )
          .map((t) => ({
            symbol: t.symbol,
            change: parseFloat(t.priceChangePercent),
            price: parseFloat(t.lastPrice)
          }))
          .filter((t) => !isNaN(t.change) && !isNaN(t.price) && t.price > 0)

        usdt.sort((a, b) => b.change - a.change)

        const summary = {
          gainers: usdt.slice(0, 10),
          losers: usdt.slice(-10).reverse(),
          updatedAt: Date.now()
        }

        return Response.json(summary, {
          headers: {
            ...CORS_HEADERS,
            'Cache-Control': 'public, max-age=30'
          }
        })
      } catch (err) {
        return new Response(`Failed to fetch Binance futures: ${err.message}`, {
          status: 500,
          headers: CORS_HEADERS
        })
      }
    }

    return new Response('Not Found.', { status: 404 })
  }
}
