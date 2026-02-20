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
