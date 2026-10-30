import type { ProjectFile, MediaType } from "./types";

type CloudProjectSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Thiếu cấu hình Supabase URL hoặc anon key.");
  return { url, anonKey };
}

function authHeaders(accessToken: string, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("apikey", supabaseConfig().anonKey);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return headers;
}

function getFileMimeType(file: File, assetType: Exclude<MediaType, "text">) {
  const ext = file.name.toLowerCase().split(".").pop();
  const byExtension: Record<string, string> = {
    mp4: "video/mp4", m4v: "video/x-m4v", mov: "video/quicktime", webm: "video/webm",
    mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav",
    ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac", weba: "audio/webm",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  };
  // Android file pickers sometimes return an empty or generic MIME type.
  const mime = !file.type || file.type === "application/octet-stream"
    ? (ext ? byExtension[ext] : undefined)
    : file.type;
  if (!mime) throw new Error(`Không xác định được định dạng media: ${file.name}`);
  if (assetType === "audio" && !mime.startsWith("audio/")) throw new Error("File đã chọn không phải âm thanh.");
  if (assetType === "video" && !mime.startsWith("video/")) throw new Error("File đã chọn không phải video.");
  if (assetType === "image" && !mime.startsWith("image/")) throw new Error("File đã chọn không phải hình ảnh.");
  return mime;
}

function safeStorageName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "media";
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!response.ok) {
    let message = body || `HTTP ${response.status}`;
    try { message = (JSON.parse(body) as { error?: string }).error || message; } catch { /* keep response text */ }
    throw new Error(message);
  }
  return body ? JSON.parse(body) as T : (undefined as T);
}

export async function listCloudProjects(accessToken: string): Promise<CloudProjectSummary[]> {
  return readJson(await fetch("/api/projects", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }));
}

export async function saveCloudProject(project: ProjectFile, accessToken: string) {
  return readJson(await fetch("/api/projects", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      id: project.project.id,
      title: project.project.name,
      projectData: project,
    }),
  }));
}

export async function loadCloudProject(projectId: string, accessToken: string): Promise<ProjectFile> {
  const rows = await readJson<Array<{ project_data: ProjectFile }>>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
  );
  if (!rows[0]?.project_data) throw new Error("Không tìm thấy dữ liệu project.");
  return rows[0].project_data;
}

export async function uploadCloudAsset(
  projectId: string,
  assetId: string,
  assetType: Exclude<MediaType, "text">,
  file: File,
  userId: string,
  accessToken: string
) {
  const { url, anonKey } = supabaseConfig();
  if (file.size > 50 * 1024 * 1024) throw new Error("Gói Supabase Free hiện giới hạn mỗi media cloud ở 50 MB.");
  const mimeType = getFileMimeType(file, assetType);
  const storagePath = `${userId}/${projectId}/${assetId}-${safeStorageName(file.name)}`;
  const objectUrl = `${url}/storage/v1/object/project-assets/${encodeStoragePath(storagePath)}`;

  const uploaded = await fetch(objectUrl, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "content-type": mimeType,
      "x-upsert": "true",
    },
    body: file,
  });
  if (!uploaded.ok) throw new Error(`Upload Storage thất bại: ${await uploaded.text()}`);

  try {
    return await readJson(await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        assetId,
        assetType,
        fileName: file.name,
        mimeType,
        fileSize: file.size,
      }),
    }));
  } catch (error) {
    await fetch(objectUrl, {
      method: "DELETE",
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
    throw error;
  }
}

export async function getCloudAssetUrl(projectId: string, assetId: string, accessToken: string): Promise<string> {
  const result = await readJson<{ signedUrl: string }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
  );
  return result.signedUrl;
}

export async function deleteCloudAsset(projectId: string, assetId: string, accessToken: string) {
  return readJson(await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  ));
}
