const PRICE_CACHE_TTL = 30;
const KV_GROUPS = "groups";
const KV_PRICES_CACHE = "prices_cache";

export default {
  async fetch(request, env) {
    // const ipAddress = req.headers.get("cf-connecting-ip") || "";
    // const { success } = await env.MY_RATE_LIMITER.limit({ key: ipAddress });
    // if (!success) {
    //   return new Response("429 Failure rate limit exceeded", {
    //     status: 429,
    //   });
    // }

    const { pathname } = new URL(request.url);
    const method = request.method;

    // GET /api/groups
    if (pathname === "/api/groups" && method === "GET") {
      const groups = (await env.KV.get(KV_GROUPS, "json")) ?? [];
      return Response.json(groups);
    }

    // PUT /api/groups — full replace
    if (pathname === "/api/groups" && method === "PUT") {
      let groups;
      try {
        groups = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
      if (!Array.isArray(groups)) {
        return new Response("Body must be an array.", { status: 400 });
      }
      await env.KV.put(KV_GROUPS, JSON.stringify(groups));
      await env.KV.delete(KV_PRICES_CACHE);
      return new Response(null, { status: 204 });
    }

    // GET /api/prices
    if (pathname === "/api/prices" && method === "GET") {
      const cache = await env.KV.get(KV_PRICES_CACHE, "json");
      if (cache) return Response.json(cache);

      const groups = (await env.KV.get(KV_GROUPS, "json")) ?? [];
      const coins = [...new Set(groups.flatMap((g) => g.coins))];

      if (coins.length === 0) {
        return Response.json({ updatedAt: Date.now(), data: [] });
      }

      // Fetch from livecoinwatch
      const APIkey = await env.SECRETS_LCW_API_KEY.get();
      const lcwRes = await fetch("https://api.livecoinwatch.com/coins/map", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": APIkey,
        },
        body: JSON.stringify({
          codes: coins,
          currency: "USD",
          sort: "rank",
          order: "ascending",
          meta: true,
        }),
      });

      if (!lcwRes.ok) return lcwRes;

      const lcwData = await lcwRes.json();
      const result = { updatedAt: Date.now(), data: lcwData };

      await env.KV.put(KV_PRICES_CACHE, JSON.stringify(result), {
        expirationTtl: PRICE_CACHE_TTL,
      });

      return Response.json(result);
    }

    return new Response("Not Found.", { status: 404 });
  },
};
