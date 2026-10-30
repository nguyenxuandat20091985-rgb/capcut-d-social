# Editor Toolkit Audit — CapCut D-Social Studio

This checklist describes the actual implementation boundary. A feature is only marked implemented when the app has working state, preview behavior, and export behavior where applicable. A visual control alone does not count.

## Implemented in the current stack (PR #1–#4)

- [x] Multiple video/image/audio/text tracks and clip placement
- [x] Clip move, trim by both edges, split, delete, cross-track move
- [x] Track mute/visibility, add track, rename track, lock/unlock track, delete track
- [x] Undo/redo and local autosave/IndexedDB media persistence
- [x] Preview playback, playhead and clip synchronization
- [x] Text overlay basics (content, size, color)
- [x] Aspect ratios 9:16, 16:9, 1:1 and 4:5
- [x] Position, scale, rotation, opacity and color adjustments
- [x] Fade and basic transitions (fade/dissolve/slide)
- [x] Speed 0.5x–2x for video/audio
- [x] Keyframe interpolation for position, scale and rotation
- [x] Audio library import, preview, timeline placement, detach audio, volume/fade and multi-track mix
- [x] MP4/WebM export at 720p/1080p

## Missing or incomplete

### P0 — Core editing parity

- [ ] Crop / free crop / fit-fill / pan-and-scan
- [ ] Flip horizontal and vertical
- [ ] Reverse video and reverse audio
- [ ] Freeze frame / hold frame
- [ ] Speed curve presets and custom speed ramp
- [ ] Keyframe opacity and smoother easing (linear/ease-in/ease-out/Bezier)
- [ ] Timeline snapping, ripple delete, insert/overwrite, duplicate clip
- [ ] Track reorder, track height control, clip grouping and multi-select editing
- [ ] Project FPS selection and custom export bitrate/codec

### P1 — Visual tools

- [ ] Mask shapes and feather controls
- [ ] Chroma key / green-screen removal
- [ ] Blend modes and compositing
- [ ] Video effects library and effect layers
- [ ] Stickers/overlays and asset packs
- [ ] Stabilization and motion blur
- [ ] Crop/transform handles directly on the preview canvas

### P1 — Text and subtitles

- [ ] Font family selection, bold/italic, alignment and line spacing
- [ ] Stroke/outline, shadow, background box and text templates
- [ ] In/out text animation presets
- [ ] Subtitle track, SRT/VTT import and SRT export
- [ ] Word-level captions and caption style presets

### P1 — Audio tools

- [ ] Voice-over recording with microphone permission and waveform
- [ ] Waveform rendering for all audio clips
- [ ] Noise reduction, voice enhancement and EQ
- [ ] Audio effects and fade curve editing
- [ ] Ducking / auto-duck under voice-over
- [ ] Licensed stock music catalogue (requires licensed provider)

### P2 — AI services (requires model/provider and secure server configuration)

- [ ] Speech-to-text auto captions
- [ ] Text-to-speech voice generation
- [ ] AI background/object removal
- [ ] Object and motion tracking
- [ ] AI reframing / subject tracking

### P2 — Export and delivery

- [ ] 2K/4K profiles where device/browser memory allows
- [ ] Custom FPS, bitrate, codec and quality presets
- [ ] Audio-only export (AAC/MP3/WAV)
- [ ] Export queue, cancel, retry and low-memory handling

## Acceptance rules

1. Every new tool must be wired to the project model and persist through save/reload.
2. Preview and export must agree for visual/audio effects.
3. Touch targets and drag gestures must work on Android Chrome.
4. Add tests for pure transform/filter/keyframe logic; run production build after each group.
5. AI and stock-media features must use a real configured provider. Do not ship fake controls or imply commercial music is licensed.
6. Keep this standalone editor isolated from D-Social Production until the user explicitly approves integration.
