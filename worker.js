const KV_GROUPS = "groups";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request, env) {
    // const ipAddress = req.headers.get("cf-connecting-ip") || "";
    // const { success } = await env.MY_RATE_LIMITER.limit({ key: ipAddress });
    // if (!success) {
    //   return new Response("429 Failure rate limit exceeded", {
    //     status: 429,
    //   });
    // }

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const { pathname } = new URL(request.url);
    const method = request.method;

    // GET /api/groups
    if (pathname === "/api/groups" && method === "GET") {
      const groups = (await env.KV.get(KV_GROUPS, "json")) ?? [];
      return Response.json(groups, { headers: CORS_HEADERS });
    }

    // PUT /api/groups — full replace
    if (pathname === "/api/groups" && method === "PUT") {
      let groups;
      try {
        groups = await request.json();
      } catch {
        return new Response("Invalid JSON", {
          status: 400,
          headers: CORS_HEADERS,
        });
      }
      if (!Array.isArray(groups)) {
        return new Response("Body must be an array.", {
          status: 400,
          headers: CORS_HEADERS,
        });
      }
      await env.KV.put(KV_GROUPS, JSON.stringify(groups));
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Proxy /api/v3/* to CoinGecko (GET only, with cf cache)
    if (pathname.startsWith("/api/v3/") && request.method === "GET") {
      const url = new URL(request.url);
      const targetUrl = "https://api.coingecko.com" + url.pathname + url.search;
      const origin = await fetch(targetUrl, {
        cf: {
          cacheEverything: true,
          cacheKey: targetUrl,
          cacheTtlByStatus: { "200-299": 60, "400-499": 0, "500-599": 0 },
        },
      });
      return origin;
    }

    return new Response("Not Found.", { status: 404 });
  },
};
