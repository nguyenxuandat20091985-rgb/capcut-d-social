export interface SupabaseRequestContext {
  url: string;
  anonKey: string;
  accessToken: string;
  userId: string;
}

export async function getSupabaseContext(request: Request): Promise<
  { context: SupabaseRequestContext; error?: never } |
  { context?: never; error: Response }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!url || !anonKey) {
    return {
      error: Response.json(
        { error: "Supabase chưa được cấu hình. Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY." },
        { status: 503 }
      ),
    };
  }

  if (!accessToken) {
    return { error: Response.json({ error: "Cần đăng nhập Supabase để lưu dự án." }, { status: 401 }) };
  }

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return { error: Response.json({ error: "Phiên đăng nhập Supabase không hợp lệ hoặc đã hết hạn." }, { status: 401 }) };
    }
    const user = await response.json() as { id?: string };
    if (!user.id) {
      return { error: Response.json({ error: "Không xác định được người dùng Supabase." }, { status: 401 }) };
    }
    return { context: { url, anonKey, accessToken, userId: user.id } };
  } catch {
    return { error: Response.json({ error: "Không kết nối được Supabase Auth." }, { status: 502 }) };
  }
}

export function supabaseHeaders(context: SupabaseRequestContext, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("apikey", context.anonKey);
  headers.set("Authorization", `Bearer ${context.accessToken}`);
  return headers;
}

export function supabaseRestUrl(context: SupabaseRequestContext, path: string): string {
  return `${context.url}/rest/v1/${path}`;
}

export function storageObjectUrl(context: SupabaseRequestContext, path: string): string {
  return `${context.url}/storage/v1/${path}`;
}

export function encodeStoragePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
