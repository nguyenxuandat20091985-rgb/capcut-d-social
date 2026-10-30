# CapCut D-Social

Social-first video editor — Next.js · TypeScript · Tailwind · Zustand · FFmpeg.wasm.

Inspired by [OpenCut](https://github.com/OpenCut-app/OpenCut).

## Features

- **Resizable layout** — Media · Preview · Properties · Timeline
- **Media upload** — Video / audio / image
- **Text overlay** — Tiếng Việt có dấu (Noto Sans khi export)
- **Timeline**
  - Kéo thân clip → di chuyển thời gian
  - Kéo cạnh → resize / trim
  - **Kéo sang track khác** → đổi track (highlight khi drop)
  - **Delete** xóa · **S** cắt tại playhead
- **Undo / Redo** — Ctrl+Z / Ctrl+Y (hoặc Ctrl+Shift+Z), tối đa 50 bước
- **Export MP4** — FFmpeg.wasm + progress bar chi tiết theo phase

## Getting Started

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

> Dùng **Chrome / Edge**. Lần đầu export tải FFmpeg core + font Noto Sans.

## Phím tắt

| Phím | Chức năng |
|------|-----------|
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Delete / Backspace | Xóa clip đang chọn |
| S | Cắt clip tại playhead |

## Export phases

1. Tải FFmpeg core  
2. Tải font Noto Sans (tiếng Việt)  
3. Ghi media vào FS ảo  
4. Dựng filter graph  
5. Encode  
6. Đóng gói & tải file  

## License

MIT
