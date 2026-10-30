import { getSupabaseContext, supabaseHeaders, supabaseRestUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getSupabaseContext(request);
  if (auth.error) return auth.error;

  const response = await fetch(
    supabaseRestUrl(auth.context, "projects?select=id,title,created_at,updated_at&order=updated_at.desc"),
    { headers: supabaseHeaders(auth.context), cache: "no-store" }
  );
  const body = await response.text();
  return new Response(body, { status: response.status, headers: { "content-type": "application/json" } });
}

export async function POST(request: Request) {
  const auth = await getSupabaseContext(request);
  if (auth.error) return auth.error;

  let body: { id?: string; title?: string; projectData?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ." }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string" || !body.projectData || typeof body.projectData !== "object") {
    return Response.json({ error: "Thiếu id hoặc projectData." }, { status: 400 });
  }

  const response = await fetch(
    supabaseRestUrl(auth.context, "projects?on_conflict=id"),
    {
      method: "POST",
      headers: supabaseHeaders(auth.context, {
        "content-type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify({
        id: body.id,
        owner_id: auth.context.userId,
        title: (body.title || "Untitled Project").slice(0, 160),
        project_data: body.projectData,
      }),
      cache: "no-store",
    }
  );

  const result = await response.text();
  return new Response(result, { status: response.status, headers: { "content-type": "application/json" } });
}
