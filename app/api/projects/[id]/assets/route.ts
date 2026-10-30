import {
  encodeStoragePath,
  getSupabaseContext,
  storageObjectUrl,
  supabaseHeaders,
  supabaseRestUrl,
} from "@/lib/supabase-rest";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } };

async function ownsProject(context: Awaited<ReturnType<typeof getSupabaseContext>> extends infer T ? Exclude<T, { error: Response }>["context"] : never, projectId: string) {
  if (!context) return false;
  const query = new URLSearchParams({ id: `eq.${projectId}`, select: "id", limit: "1" });
  const response = await fetch(supabaseRestUrl(context, `projects?${query}`), {
    headers: supabaseHeaders(context),
    cache: "no-store",
  });
  if (!response.ok) return false;
  const rows = await response.json() as unknown[];
  return rows.length > 0;
}

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await getSupabaseContext(request);
  if (auth.error) return auth.error;
  if (!(await ownsProject(auth.context, params.id))) {
    return Response.json({ error: "Không tìm thấy project hoặc không có quyền truy cập." }, { status: 404 });
  }

  const query = new URLSearchParams({
    project_id: `eq.${params.id}`,
    select: "id,asset_type,file_name,mime_type,file_size,created_at",
    order: "created_at.asc",
  });
  const response = await fetch(supabaseRestUrl(auth.context, `project_assets?${query}`), {
    headers: supabaseHeaders(auth.context),
    cache: "no-store",
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await getSupabaseContext(request);
  if (auth.error) return auth.error;
  if (!(await ownsProject(auth.context, params.id))) {
    return Response.json({ error: "Không tìm thấy project hoặc không có quyền truy cập." }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const assetId = form.get("assetId");
  const assetType = form.get("assetType");
  if (!(file instanceof File) || typeof assetId !== "string" || !assetId ||
      !["video", "audio", "image"].includes(String(assetType))) {
    return Response.json({ error: "Thiếu file, assetId hoặc assetType không hợp lệ." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > 500 * 1024 * 1024) {
    return Response.json({ error: "File phải lớn hơn 0 và không vượt quá 500 MB." }, { status: 413 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "media";
  const storagePath = `${auth.context.userId}/${params.id}/${assetId}-${safeName}`;
  const objectUrl = storageObjectUrl(auth.context, `object/project-assets/${encodeStoragePath(storagePath)}`);
  const upload = await fetch(objectUrl, {
    method: "POST",
    headers: supabaseHeaders(auth.context, {
      "content-type": file.type || "application/octet-stream",
      "x-upsert": "true",
    }),
    body: new Uint8Array(await file.arrayBuffer()),
    cache: "no-store",
  });
  if (!upload.ok) {
    return Response.json({ error: "Upload lên Supabase Storage thất bại.", detail: await upload.text() }, { status: upload.status });
  }

  const insert = await fetch(supabaseRestUrl(auth.context, "project_assets"), {
    method: "POST",
    headers: supabaseHeaders(auth.context, {
      "content-type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify({
      id: assetId,
      project_id: params.id,
      owner_id: auth.context.userId,
      asset_type: assetType,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      file_size: file.size,
      storage_path: storagePath,
    }),
    cache: "no-store",
  });

  if (!insert.ok) {
    await fetch(objectUrl, { method: "DELETE", headers: supabaseHeaders(auth.context), cache: "no-store" });
    return Response.json({ error: "Không lưu được metadata media.", detail: await insert.text() }, { status: insert.status });
  }

  return new Response(await insert.text(), {
    status: insert.status,
    headers: { "content-type": "application/json" },
  });
}
