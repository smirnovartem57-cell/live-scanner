type Payload = { action?: "read" | "save-profile" | "vote"; profile?: Record<string, unknown>; feedbackId?: string };
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-live-scanner-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!hasAccess(request)) return json({ error: "Access denied" }, 403);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Supabase function is not configured" }, 500);
  try {
    const payload = await request.json() as Payload;
    if (payload.action === "save-profile") {
      if (!payload.profile?.id) return json({ error: "Profile id is required" }, 400);
      await rest(url, key, "app_profiles?on_conflict=id", "POST", [toProfileRow(payload.profile)], "resolution=merge-duplicates");
    } else if (payload.action === "vote") {
      if (!payload.feedbackId) return json({ error: "Feedback id is required" }, 400);
      await rest(url, key, "rpc/increment_feedback_votes", "POST", { item_id: payload.feedbackId });
    } else if (payload.action !== "read" && payload.action !== undefined) {
      return json({ error: "Unknown action" }, 400);
    }
    return json(await readAll(url, key));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Social data request failed" }, 500);
  }
});

function hasAccess(request: Request) {
  const expected = Deno.env.get("SOCIAL_DATA_ACCESS_TOKEN") || Deno.env.get("JOURNAL_ACCESS_TOKEN");
  return Boolean(expected) && request.headers.get("x-live-scanner-key") === expected;
}
async function readAll(url: string, key: string) {
  const profiles = await rest(url, key, "app_profiles?select=*&order=updated_at.desc&limit=1", "GET") as Record<string, unknown>[];
  const items = await rest(url, key, "feedback_items?select=*&order=created_at.desc", "GET") as Record<string, unknown>[];
  return { ok: true, profile: profiles[0] ? toProfile(profiles[0]) : null, feedbackItems: items.map(toFeedback) };
}
async function rest(url: string, key: string, path: string, method: string, body?: unknown, prefer?: string): Promise<unknown> {
  const response = await fetch(`${url}/rest/v1/${path}`, { method, headers: {
    apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(prefer ? { prefer } : {})
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error(`Supabase ${path} failed: ${await response.text()}`);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}
function toProfileRow(value: Record<string, unknown>) {
  return { id: value.id, display_name: value.displayName, handle: value.handle, role: value.role,
    access_level: value.accessLevel, joined_at: value.joinedAt, public_profile_ready: value.publicProfileReady,
    avatar: value.avatar, bio: value.bio, social_trust: value.socialTrust, permissions: value.permissions,
    future_fields: value.futureFields, updated_at: new Date().toISOString() };
}
function toProfile(row: Record<string, unknown>) {
  return { id: row.id, displayName: row.display_name, handle: row.handle, role: row.role,
    accessLevel: row.access_level, joinedAt: row.joined_at, publicProfileReady: row.public_profile_ready,
    avatar: row.avatar, bio: row.bio, socialTrust: row.social_trust, permissions: row.permissions, futureFields: row.future_fields };
}
function toFeedback(row: Record<string, unknown>) {
  return { id: row.id, type: row.type, title: row.title, description: row.description, status: row.status,
    priority: row.priority, votes: row.votes, createdAt: row.created_at };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json" } });
}
