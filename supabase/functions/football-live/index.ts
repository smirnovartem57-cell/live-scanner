type FootballLivePayload = {
  scope?: "live-snapshot";
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-live-scanner-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!hasAccess(request)) {
    return json({ error: "Access denied" }, 403);
  }

  const payload = await request.json() as FootballLivePayload;

  if (payload.scope !== "live-snapshot") {
    return json({ error: "Unsupported scope" }, 400);
  }

  return json({
    ok: true,
    provider: "not_configured",
    message: "Real football provider is not connected yet.",
    data: {
      matches: [],
      snapshots: [],
      events: {},
      signals: [],
      history: [],
      teamProfiles: [],
      feedbackItems: []
    }
  });
});

function hasAccess(request: Request) {
  const expectedToken = Deno.env.get("FOOTBALL_DATA_ACCESS_TOKEN") || Deno.env.get("JOURNAL_ACCESS_TOKEN");
  return Boolean(expectedToken) && request.headers.get("x-live-scanner-key") === expectedToken;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json"
    }
  });
}
