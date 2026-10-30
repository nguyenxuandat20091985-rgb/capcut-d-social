import { encodeStoragePath, getSupabaseContext, storageObjectUrl, supabaseHeaders, supabaseRestUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } };

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await getSupabaseContext(request);
  if (auth.error) return auth.error;

  const query = new URLSearchParams({
    id: `eq.${params.id}`,
    select: "id,title,project_data,created_at,updated_at",
    limit: "1",
  });
  const response = await fetch(supabaseRestUrl(auth.context, `projects?${query}`), {
    headers: supabaseHeaders(auth.context),
    cache: "no-store",
  });
  const result = await response.text();
  return new Response(result, { status: response.status, headers: { "content-type": "application/json" } });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await getSupabaseContext(request);
  if (auth.error) return auth.error;

  let body: { title?: string; projectData?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.slice(0, 160);
  if (body.projectData && typeof body.projectData === "object") patch.project_data = body.projectData;
  if (!Object.keys(patch).length) return Response.json({ error: "Không có dữ liệu cần cập nhật." }, { status: 400 });

  const query = new URLSearchParams({ id: `eq.${params.id}`, select: "id,title,updated_at" });
  const response = await fetch(supabaseRestUrl(auth.context, `projects?${query}`), {
    method: "PATCH",
    headers: supabaseHeaders(auth.context, {
      "content-type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  const result = await response.text();
  return new Response(result, { status: response.status, headers: { "content-type": "application/json" } });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const auth = await getSupabaseContext(request);
  if (auth.error) return auth.error;

  const assetQuery = new URLSearchParams({
    project_id: `eq.${params.id}`,
    select: "storage_path",
  });
  const assetsResponse = await fetch(
    supabaseRestUrl(auth.context, `project_assets?${assetQuery}`),
    { headers: supabaseHeaders(auth.context), cache: "no-store" }
  );
  if (!assetsResponse.ok) {
    return Response.json({ error: await assetsResponse.text() }, { status: assetsResponse.status });
  }
  const assets = await assetsResponse.json() as Array<{ storage_path: string }>;
  for (const asset of assets) {
    const objectUrl = storageObjectUrl(
      auth.context,
      `object/project-assets/${encodeStoragePath(asset.storage_path)}`
    );
    const removed = await fetch(objectUrl, {
      method: "DELETE",
      headers: supabaseHeaders(auth.context),
      cache: "no-store",
    });
    if (!removed.ok) {
      return Response.json(
        { error: "Không xóa được một media trong Storage; project chưa bị xóa.", detail: await removed.text() },
        { status: 502 }
      );
    }
  }

  const query = new URLSearchParams({ id: `eq.${params.id}` });
  const response = await fetch(supabaseRestUrl(auth.context, `projects?${query}`), {
    method: "DELETE",
    headers: supabaseHeaders(auth.context, { Prefer: "return=minimal" }),
    cache: "no-store",
  });
  if (!response.ok) {
    return Response.json({ error: await response.text() }, { status: response.status });
  }
  return Response.json({ success: true });
}
