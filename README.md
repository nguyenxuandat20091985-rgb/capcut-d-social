# CapCut D-Social

Editor video social — Next.js · Zustand · FFmpeg.wasm.

## Tính năng chính

| Nhóm | Chi tiết |
|------|----------|
| Timeline | Kéo clip, đổi track, resize, split (S), Delete |
| Undo/Redo | Ctrl+Z / Ctrl+Y, 50 bước |
| Text | Overlay tiếng Việt (Noto Sans khi export) |
| Fade & Transition | Fade In/Out, Dissolve, Fade, Slide |
| Audio | Volume per clip, **Detach Audio** từ video |
| Project | Save/Load JSON (Ctrl+S), autosave localStorage 15s |
| Export | MP4 720p / 1080p, progress theo phase |

## Chạy

```bash
npm install
npm run dev
```

Chrome/Edge khuyến nghị (SharedArrayBuffer + WASM).

## Phím tắt

- **Ctrl+Z / Ctrl+Y** — Undo / Redo  
- **Ctrl+S** — Save project JSON  
- **Delete** — Xóa clip  
- **S** — Cắt tại playhead  

## Lưu project

- **Save**: tải file `.cds.json` (cấu trúc timeline; blob media không đi kèm)  
- **Autosave**: localStorage mỗi 15s (giữ blob URL trong cùng phiên)  
- **Load**: mở file JSON — cần upload lại media nếu đã reload trang  

Supabase cloud save có thể gắn thêm qua API route khi có credentials d-social.

## License

MIT
