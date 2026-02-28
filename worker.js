const KV_GROUPS = "groups";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const { pathname } = new URL(request.url);
    const method = request.method;

    // GET /api
    if (pathname === "/api" && method === "GET") {
      // 直接从 Header 中提取邮箱
      const userEmail = request.headers.get(
        "Cf-Access-Authenticated-User-Email",
      );

      if (!userEmail) {
        return new Response("未发现 Access 认证信息", { status: 401 });
      }

      return new Response(`你好，验证码登录用户: ${userEmail}`);
    }

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
        headers: request.headers,
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
