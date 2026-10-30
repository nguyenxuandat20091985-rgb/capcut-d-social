import type { MediaAsset } from "./types";

const DB_NAME = "capcut-d-social-media";
const STORE_NAME = "assets";
const DB_VERSION = 1;

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Trình duyệt không hỗ trợ IndexedDB"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Không mở được IndexedDB"));
  });
}

export async function saveMediaFile(id: string, file: Blob): Promise<void> {
  const db = await openMediaDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({
        id,
        blob: file,
        savedAt: Date.now(),
        mimeType: file.type,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Không lưu được media"));
      tx.onabort = () => reject(tx.error ?? new Error("Lưu media bị hủy"));
    });
  } finally {
    db.close();
  }
}

export async function deleteMediaFile(id: string): Promise<void> {
  const db = await openMediaDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Không xóa được media"));
    });
  } finally {
    db.close();
  }
}

export async function restoreMediaSources(media: MediaAsset[]): Promise<MediaAsset[]> {
  if (typeof indexedDB === "undefined" || media.length === 0) return media;
  const db = await openMediaDb();
  try {
    return await Promise.all(media.map(async (asset) => {
      if (asset.type === "text" || (asset.src && !asset.src.startsWith("blob:"))) return asset;
      const blob = await new Promise<Blob | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(asset.id);
        request.onsuccess = () => resolve(request.result?.blob as Blob | undefined);
        request.onerror = () => reject(request.error);
      });
      return blob ? { ...asset, src: URL.createObjectURL(blob), fileSize: asset.fileSize ?? blob.size, mimeType: asset.mimeType || blob.type } : asset;
    }));
  } finally {
    db.close();
  }
}
