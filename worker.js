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

    // Proxy /api/v3/* to CoinGecko
    if (pathname.startsWith("/api/v3/")) {
      const url = new URL(request.url);
      const targetUrl = "https://api.coingecko.com" + url.pathname + url.search;
      const proxyHeaders = new Headers(request.headers);
      proxyHeaders.delete("host");
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
      });
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type":
            response.headers.get("Content-Type") ?? "application/json",
          ...CORS_HEADERS,
        },
      });
    }

    return new Response("Not Found.", { status: 404, headers: CORS_HEADERS });
  },
};
