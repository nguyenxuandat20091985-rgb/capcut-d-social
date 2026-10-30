"use client";

const SESSION_KEY = "capcut-d-social-auth-session";

export interface EditorAuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
}

type AuthPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string };
  msg?: string;
  message?: string;
  error_description?: string;
  error?: string;
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase chưa được cấu hình trên Preview.");
  return { url, key };
}

function saveSession(payload: AuthPayload): EditorAuthSession {
  if (!payload.access_token || !payload.refresh_token || !payload.user?.id) {
    throw new Error("Supabase chưa trả về phiên đăng nhập đầy đủ.");
  }
  const session: EditorAuthSession = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: Date.now() + Math.max(60, payload.expires_in ?? 3600) * 1000,
    user: { id: payload.user.id, email: payload.user.email },
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function authRequest(path: string, body: Record<string, string>): Promise<AuthPayload> {
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as AuthPayload;
  if (!response.ok) {
    throw new Error(payload.msg || payload.message || payload.error_description || payload.error || `Supabase Auth lỗi (${response.status})`);
  }
  return payload;
}

export async function signInWithPassword(email: string, password: string): Promise<EditorAuthSession> {
  const payload = await authRequest("token?grant_type=password", { email, password });
  return saveSession(payload);
}

export async function signUpWithPassword(email: string, password: string): Promise<EditorAuthSession | null> {
  const payload = await authRequest("signup", { email, password });
  if (!payload.access_token) return null; // Email confirmation is enabled.
  return saveSession(payload);
}

export async function getEditorSession(): Promise<EditorAuthSession | null> {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  let current: EditorAuthSession;
  try {
    current = JSON.parse(raw) as EditorAuthSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  if (!current.refresh_token || !current.user?.id) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  if (current.expires_at > Date.now() + 60_000) return current;
  try {
    const payload = await authRequest("token?grant_type=refresh_token", {
      refresh_token: current.refresh_token,
    });
    return saveSession({ ...payload, user: payload.user ?? current.user });
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export async function signOutEditor(): Promise<void> {
  const current = await getEditorSession();
  if (current) {
    const { url, key } = config();
    await fetch(`${url}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${current.access_token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }
  localStorage.removeItem(SESSION_KEY);
}
