"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Cloud, CloudDownload, CloudUpload, LogOut, Loader2, X } from "lucide-react";
import { useEditorStore } from "@/lib/store";
import type { MediaAsset, ProjectFile } from "@/lib/types";
import {
  getCloudAssetUrl,
  listCloudProjects,
  loadCloudProject,
  saveCloudProject,
  uploadCloudAsset,
} from "@/lib/cloud-projects";
import { getMediaFile, saveMediaFile } from "@/lib/media-db";
import {
  getEditorSession,
  signInWithPassword,
  signOutEditor,
  signUpWithPassword,
  type EditorAuthSession,
} from "@/lib/editor-auth";

type CloudProjectRow = { id: string; title: string; updated_at: string };

export default function CloudProjectsPanel() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<EditorAuthSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [projects, setProjects] = useState<CloudProjectRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshProjects = useCallback(async (active: EditorAuthSession) => {
    const rows = await listCloudProjects(active.access_token);
    setProjects(rows);
  }, []);

  const ensureSession = async () => {
    const active = await getEditorSession();
    if (!active) {
      setSession(null);
      throw new Error("Phiên Cloud đã hết hạn. Vui lòng đăng nhập lại.");
    }
    setSession(active);
    return active;
  };

  useEffect(() => {
    let alive = true;
    void getEditorSession().then(async (active) => {
      if (!alive) return;
      setSession(active);
      if (active) {
        try {
          await refreshProjects(active);
        } catch (err) {
          if (alive) setError(err instanceof Error ? err.message : "Không tải được project Cloud.");
        }
      }
    }).catch((err) => {
      if (alive) setError(err instanceof Error ? err.message : "Không khôi phục được phiên đăng nhập.");
    });
    return () => { alive = false; };
  }, [refreshProjects]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signin") {
        const active = await signInWithPassword(email.trim(), password);
        setSession(active);
        await refreshProjects(active);
        setPassword("");
        setMessage("Đã đăng nhập. Project Cloud đã sẵn sàng.");
      } else {
        const active = await signUpWithPassword(email.trim(), password);
        setPassword("");
        if (active) {
          setSession(active);
          await refreshProjects(active);
          setMessage("Đã tạo tài khoản và đăng nhập.");
        } else {
          setMessage("Tài khoản đã được gửi yêu cầu tạo. Hãy mở email xác nhận, sau đó quay lại đăng nhập.");
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xác thực tài khoản.");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!session) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const active = await ensureSession();
      const state = useEditorStore.getState();
      const file = state.exportProjectFile();
      await saveCloudProject(file, active.access_token);
      let uploaded = 0;
      let skipped = 0;
      for (const asset of file.media) {
        if (asset.type === "text") continue;
        try {
          const blob = await getMediaFile(asset.id);
          if (!blob) {
            if (!asset.src || asset.src.startsWith("blob:")) skipped++;
            continue;
          }
          const uploadFile = new File([blob], asset.name, {
            type: asset.mimeType || blob.type || "application/octet-stream",
          });
          await uploadCloudAsset(
            file.project.id,
            asset.id,
            asset.type,
            uploadFile,
            active.user.id,
            active.access_token
          );
          uploaded++;
        } catch (err) {
          skipped++;
          console.warn("Cloud asset upload skipped", asset.name, err);
        }
      }
      await refreshProjects(active);
      setMessage(
        skipped > 0
          ? `Đã lưu project; tải lên ${uploaded} media, còn ${skipped} media chưa đồng bộ (kiểm tra giới hạn 50 MB/định dạng).`
          : `Đã lưu project và đồng bộ ${uploaded} media lên Cloud.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được project lên Cloud.");
    } finally {
      setBusy(false);
    }
  };

  const handleLoad = async (projectId: string) => {
    if (!session) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const active = await ensureSession();
      const file = await loadCloudProject(projectId, active.access_token);
      let missing = 0;
      const restoredMedia = await Promise.all(file.media.map(async (asset) => {
        if (asset.type === "text" || (asset.src && !asset.src.startsWith("blob:"))) {
          return asset;
        }
        try {
          const signedUrl = await getCloudAssetUrl(projectId, asset.id, active.access_token);
          const response = await fetch(signedUrl, { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          await saveMediaFile(asset.id, blob);
          return {
            ...asset,
            src: URL.createObjectURL(blob),
            fileSize: asset.fileSize ?? blob.size,
            mimeType: asset.mimeType || blob.type,
          };
        } catch (err) {
          console.warn("Cloud media restore failed", asset.name, err);
          missing++;
          return { ...asset, src: "" };
        }
      }));
      const hydrated: ProjectFile = { ...file, media: restoredMedia };
      useEditorStore.getState().importProjectFile(hydrated);
      useEditorStore.setState({ media: restoredMedia as MediaAsset[] });
      setOpen(false);
      setMessage(
        missing > 0
          ? `Đã mở project; còn ${missing} media chưa khôi phục được.`
          : "Đã mở project và khôi phục media từ Cloud."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không mở được project Cloud.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOutEditor();
      setSession(null);
      setProjects([]);
      setMessage("Đã đăng xuất Cloud.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(true); setError(""); }}
        title="Project Cloud"
        aria-label="Mở project Cloud"
        className="flex items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 hover:border-blue-500 hover:text-white"
      >
        <Cloud size={15} />
        <span className="hidden sm:inline">Cloud</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3" role="presentation" onMouseDown={(e) => {
          if (e.target === e.currentTarget && !busy) setOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="cloud-title"
            className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-950 text-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <Cloud size={18} className="text-blue-400" />
                <h2 id="cloud-title" className="text-sm font-semibold">Project Cloud</h2>
              </div>
              <button type="button" disabled={busy} onClick={() => setOpen(false)} aria-label="Đóng"
                className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"><X size={17} /></button>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {error && <p role="alert" className="rounded-lg border border-red-900/70 bg-red-950/40 p-2.5 text-xs text-red-300">{error}</p>}
              {message && <p role="status" className="rounded-lg border border-blue-900/70 bg-blue-950/40 p-2.5 text-xs text-blue-200">{message}</p>}

              {!session ? (
                <form onSubmit={handleAuth} className="space-y-3">
                  <p className="text-xs leading-relaxed text-gray-400">
                    Đăng nhập tài khoản Supabase để lưu và mở project trên nhiều thiết bị.
                  </p>
                  <label className="block text-xs text-gray-400">Email
                    <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </label>
                  <label className="block text-xs text-gray-400">Mật khẩu
                    <input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
                  </label>
                  <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-60">
                    {busy && <Loader2 size={15} className="animate-spin" />}
                    {mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}
                    className="w-full py-1 text-xs text-blue-300 hover:text-blue-200">
                    {mode === "signin" ? "Chưa có tài khoản? Tạo tài khoản mới" : "Đã có tài khoản? Đăng nhập"}
                  </button>
                </form>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-900 p-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">Đang đăng nhập</p>
                      <p className="truncate text-xs text-gray-200">{session.user.email || session.user.id}</p>
                    </div>
                    <button type="button" disabled={busy} onClick={() => void handleSignOut()} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-700 px-2 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800">
                      <LogOut size={13} /> Thoát
                    </button>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void handleSave()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-60">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
                    Lưu project hiện tại lên Cloud
                  </button>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-gray-300">Project đã lưu</h3>
                      <button type="button" disabled={busy} onClick={() => void refreshProjects(session)} className="text-[11px] text-blue-300 hover:text-blue-200">Làm mới</button>
                    </div>
                    {projects.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-gray-800 py-6 text-center text-xs text-gray-500">Chưa có project Cloud</p>
                    ) : projects.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-gray-200">{item.title}</p>
                          <p className="text-[10px] text-gray-500">{new Date(item.updated_at).toLocaleString("vi-VN")}</p>
                        </div>
                        <button type="button" disabled={busy} onClick={() => void handleLoad(item.id)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gray-700 px-2.5 py-2 text-[11px] text-white hover:bg-gray-600">
                          <CloudDownload size={13} /> Mở
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <footer className="border-t border-gray-800 px-4 py-2.5 text-[10px] leading-relaxed text-gray-500">
              Media Cloud hiện giới hạn 50 MB mỗi file theo cấu hình bucket. Project local vẫn được lưu trên thiết bị.
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
