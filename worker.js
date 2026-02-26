const KV_GROUPS = "groups";

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
      return new Response(null, { status: 204 });
    }

    return new Response("Not Found.", { status: 404 });
  },
};
