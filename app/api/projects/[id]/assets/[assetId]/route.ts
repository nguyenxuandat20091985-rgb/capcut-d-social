import {
  encodeStoragePath,
  getSupabaseContext,
  storageObjectUrl,
  supabaseHeaders,
  supabaseRestUrl,
} from "@/lib/supabase-rest";

export const runtime = "nodejs";

type RouteContext = { params: { id: string; assetId: string } };

async function findAsset(request: Request, projectId: string, assetId: string) {
  const auth = await getSupabaseContext(request);
  if (auth.error) return { error: auth.error } as const;
  const query = new URLSearchParams({
    id: `eq.${assetId}`,
    project_id: `eq.${projectId}`,
    select: "id,asset_type,file_name,mime_type,file_size,storage_path,created_at",
    limit: "1",
  });
  const response = await fetch(supabaseRestUrl(auth.context, `project_assets?${query}`), {
    headers: supabaseHeaders(auth.context),
    cache: "no-store",
  });
  if (!response.ok) return { error: Response.json({ error: await response.text() }, { status: response.status }) } as const;
  const rows = await response.json() as Array<Record<string, unknown>>;
  if (!rows[0]) return { error: Response.json({ error: "Không tìm thấy media." }, { status: 404 }) } as const;
  return { context: auth.context, asset: rows[0] } as const;
}

export async function GET(request: Request, { params }: RouteContext) {
  const found = await findAsset(request, params.id, params.assetId);
  if ("error" in found) return found.error;

  const signed = await fetch(
    storageObjectUrl(found.context, `object/sign/project-assets/${encodeStoragePath(String(found.asset.storage_path))}`),
    {
      method: "POST",
      headers: supabaseHeaders(found.context, { "content-type": "application/json" }),
      body: JSON.stringify({ expiresIn: 3600 }),
      cache: "no-store",
    }
  );
  if (!signed.ok) {
    return Response.json({ error: "Không tạo được link tải media.", detail: await signed.text() }, { status: signed.status });
  }
  const result = await signed.json() as { signedURL?: string; signedUrl?: string };
  const rawSignedUrl = result.signedURL ?? result.signedUrl;
  if (!rawSignedUrl) return Response.json({ error: "Supabase không trả về signed URL." }, { status: 502 });
  const signedUrl = /^https?:\\/\\//i.test(rawSignedUrl)
    ? rawSignedUrl
    : rawSignedUrl.startsWith("/storage/v1/")
      ? `${found.context.url}${rawSignedUrl}`
      : `${found.context.url}/storage/v1${rawSignedUrl.startsWith("/") ? "" : "/"}${rawSignedUrl}`;
  return Response.json({ asset: found.asset, signedUrl });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const found = await findAsset(request, params.id, params.assetId);
  if ("error" in found) return found.error;

  const objectUrl = storageObjectUrl(found.context, `object/project-assets/${encodeStoragePath(String(found.asset.storage_path))}`);
  const removed = await fetch(objectUrl, {
    method: "DELETE",
    headers: supabaseHeaders(found.context),
    cache: "no-store",
  });
  if (!removed.ok) {
    return Response.json({ error: "Không xóa được file trong Storage.", detail: await removed.text() }, { status: removed.status });
  }

  const query = new URLSearchParams({ id: `eq.${params.assetId}`, project_id: `eq.${params.id}` });
  const row = await fetch(supabaseRestUrl(found.context, `project_assets?${query}`), {
    method: "DELETE",
    headers: supabaseHeaders(found.context, { Prefer: "return=minimal" }),
    cache: "no-store",
  });
  if (!row.ok) return Response.json({ error: await row.text() }, { status: row.status });
  return Response.json({ success: true });
}
