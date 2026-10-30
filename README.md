# CapCut D-Social

A CapCut-inspired social media video editor built with **Next.js**, **TypeScript**, **Tailwind CSS**, and **Zustand**.

Architecture and UX patterns inspired by [OpenCut](https://github.com/OpenCut-app/OpenCut) / [opencut-classic](https://github.com/OpenCut-app/opencut-classic).

## Features

- **Resizable layout** — Media panel · Preview · Properties · Timeline (react-resizable-panels)
- **Media upload** — Video / audio / image, auto-added to timeline
- **Multi-track timeline** — Video & audio tracks, mute / visibility, playhead
- **Clip selection** — Click / Shift+click, Delete to remove, **S** to split at playhead
- **Properties panel** — Opacity, scale, rotation, volume, start/duration
- **Project settings** — Aspect ratio (9:16, 16:9, 1:1, 4:5), background color
- **Playback** — Play / pause with requestAnimationFrame clock
- **Export** — Placeholder pipeline ready for FFmpeg.wasm / mediabunny

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
capcut-d-social
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.ts
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   └── page.tsx
├── components/
│   ├── Editor.tsx          # Resizable shell (OpenCut-style)
│   ├── EditorHeader.tsx
│   ├── Preview.tsx
│   ├── Timeline.tsx
│   ├── MediaPanel.tsx
│   └── PropertiesPanel.tsx
└── lib/
    ├── types.ts
    ├── store.ts            # Zustand editor store
    ├── exporter.ts
    └── utils.ts
```

## Roadmap (from OpenCut ideas)

- [ ] Drag clips on timeline
- [ ] Undo / redo history
- [ ] Keyframes & effects
- [ ] Real export with FFmpeg.wasm
- [ ] Text overlays
- [ ] Transitions

## License

MIT
