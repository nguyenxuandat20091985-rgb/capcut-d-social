# CapCut D-Social

Social-first video editor built with **Next.js**, **TypeScript**, **Tailwind**, **Zustand**, and **FFmpeg.wasm**.

Inspired by [OpenCut](https://github.com/OpenCut-app/OpenCut).

## Features

- **Resizable layout** — Media · Preview · Properties · Timeline
- **Media upload** — Video / audio / image → auto-placed on timeline
- **Text overlay** — Add subtitle-style text clips with font size & color
- **Drag & drop timeline**
  - Drag clip body → move in time
  - Drag left/right edge → resize / trim
  - **Delete** remove · **S** split at playhead
- **Multi-track** — Video, Text, Audio (mute / visibility)
- **Playback** — Play / Pause with live preview
- **Real export** — FFmpeg.wasm → downloadable **MP4**

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** First export downloads FFmpeg core (~25MB). Use **Chrome / Edge** for best WASM + SharedArrayBuffer support (COOP/COEP headers are set in `next.config.js`).

## Workflow

1. **Upload** video/image or click **Add Text Overlay**
2. **Drag** clips on the timeline to arrange
3. Select a clip → tweak **Properties** (text, opacity, scale…)
4. Hit **Export MP4** → file downloads when encoding finishes

## Project Structure

```
components/
  Editor.tsx          # Resizable shell
  EditorHeader.tsx    # Play + Export
  Preview.tsx
  Timeline.tsx        # Drag / resize / split
  MediaPanel.tsx      # Upload + Text
  PropertiesPanel.tsx
lib/
  types.ts
  store.ts
  exporter.ts         # FFmpeg.wasm pipeline
  utils.ts
```

## Export notes

- Client-side only — fine for short social clips (15–60s)
- Long / many 4K sources may be slow or hit memory limits
- For production scale, move rendering to a worker / server

## License

MIT
