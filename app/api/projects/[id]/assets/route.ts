import {
  encodeStoragePath,
  getSupabaseContext,
  storageObjectUrl,
  supabaseHeaders,
  supabaseRestUrl,
  type SupabaseRequestContext,
} from "@/lib/supabase-rest";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } };

async function ownsProject(context: SupabaseRequestContext, projectId: string) {
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

  let body: {
    assetId?: string;
    assetType?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON metadata không hợp lệ." }, { status: 400 });
  }

  if (!body.assetId || !["video", "audio", "image"].includes(String(body.assetType)) ||
      !body.fileName || !body.mimeType || !Number.isFinite(body.fileSize)) {
    return Response.json({ error: "Thiếu assetId, assetType hoặc thông tin file." }, { status: 400 });
  }
  if ((body.fileSize ?? 0) <= 0 || (body.fileSize ?? 0) > 500 * 1024 * 1024) {
    return Response.json({ error: "File phải lớn hơn 0 và không vượt quá 500 MB." }, { status: 413 });
  }

  // Upload bytes directly from the browser to Supabase Storage; never proxy large video files through a Vercel Function.
  const safeName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "media";
  const storagePath = `${auth.context.userId}/${params.id}/${body.assetId}-${safeName}`;
  const infoUrl = storageObjectUrl(auth.context, `object/info/project-assets/${encodeStoragePath(storagePath)}`);
  const storedObject = await fetch(infoUrl, {
    headers: supabaseHeaders(auth.context),
    cache: "no-store",
  });
  if (!storedObject.ok) {
    return Response.json({ error: "Chưa tìm thấy file trong Storage. Hãy upload file trực tiếp lên bucket trước khi đăng ký metadata." }, { status: 409 });
  }

  const insert = await fetch(supabaseRestUrl(auth.context, "project_assets"), {
    method: "POST",
    headers: supabaseHeaders(auth.context, {
      "content-type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify({
      id: body.assetId,
      project_id: params.id,
      owner_id: auth.context.userId,
      asset_type: body.assetType,
      file_name: body.fileName,
      mime_type: body.mimeType,
      file_size: body.fileSize,
      storage_path: storagePath,
    }),
    cache: "no-store",
  });

  const result = await insert.text();
  return new Response(result, {
    status: insert.status,
    headers: { "content-type": "application/json" },
  });
}
