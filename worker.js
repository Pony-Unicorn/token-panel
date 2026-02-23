const PRICE_CACHE_TTL = 120;

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const method = request.method;

    // GET /api/groups
    if (pathname === "/api/groups" && method === "GET") {
      const groups = (await env.KV.get("groups", "json")) ?? [];
      return Response.json(groups);
    }

    // PUT /api/groups — full replace
    if (pathname === "/api/groups" && method === "PUT") {
      let groups;
      try {
        groups = await request.json();
      } catch {
        return new Response("Invalid JSON", {
          status: 400,
        });
      }
      if (!Array.isArray(groups)) {
        return new Response("Body must be an array.", {
          status: 400,
        });
      }
      await env.KV.put("groups", JSON.stringify(groups));
      await env.KV.delete("prices_cache"); // invalidate so next fetch is fresh
      return new Response(null, {
        status: 204,
      });
    }

    // GET /api/prices
    if (pathname === "/api/prices" && method === "GET") {
      const cache = await env.KV.get("prices_cache", "json");
      if (cache) return Response.json(cache);

      const groups = (await env.KV.get("groups", "json")) ?? [];
      const coins = [...new Set(groups.flatMap((g) => g.coins))];

      if (coins.length === 0) {
        return Response.json({ updatedAt: Date.now(), data: {} });
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
          meta: true,
        }),
      });

      if (!lcwRes.ok) {
        return new Response("Failed to fetch prices", { status: 502 });
      }

      const lcwData = await lcwRes.json();
      const result = { updatedAt: Date.now(), data: lcwData };

      await env.KV.put("prices_cache", JSON.stringify(result), {
        expirationTtl: PRICE_CACHE_TTL,
      });

      return Response.json(result);
    }

    return new Response("Not Found.", { status: 404 });
  },
};
