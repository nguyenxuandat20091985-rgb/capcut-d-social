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
  const storagePath = `${userId}/${projectId}/${assetId}-${safeStorageName(file.name)}`;
  const objectUrl = `${url}/storage/v1/object/project-assets/${encodeStoragePath(storagePath)}`;

  const uploaded = await fetch(objectUrl, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "content-type": file.type || "application/octet-stream",
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
        mimeType: file.type || "application/octet-stream",
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
