# Android test checklist

Only mark a step as passed after testing on a real Android phone. A green CI/Vercel build does not replace these checks.

## Import and local persistence
1. Open the Media tab and import MP4, MOV, WebM, JPG/PNG/WEBP.
2. Confirm the picker accepts both video and images, reads the original duration and creates a thumbnail.
3. Open Kho nhạc, import MP3, M4A, AAC and WAV/OGG/FLAC where the device supports them.
4. Play an audio preview in the library, add two different tracks to Timeline, and confirm the clips can overlap.
5. Refresh the page; confirm project metadata and original media restore from IndexedDB.
6. Remove one media asset; confirm its clip and local stored blob are removed.

## Preview and timeline
7. Test Play/Pause, seek, and playhead synchronization.
8. Drag clips, change tracks, trim both clip edges, split, delete, Undo and Redo.
9. Test 0.5x, 1x and 2x speed on both video and audio.
10. Test source video audio, mute/volume, Detach Audio and the detached audio clip.
11. Test text overlay content, Vietnamese font, position, scale, rotation, opacity and fade.
12. Test video/image position (negative and positive X/Y), scale, rotation and opacity.
13. Test filter presets and manual brightness, contrast, saturation, hue and blur controls.
14. Test fade in/out and slide transitions on text, image and video.
15. Test audio clip volume, track volume, fade in/out and overlapping audio.

## Export
16. Export a short 720p MP4 containing one video, one image, a text layer and two overlapping audio tracks.
17. Export a project with trim, speed, filter, scale, rotation, position, opacity, slide transition and audio fade.
18. Play the exported MP4 in Android Gallery and check duration, image, text, sound synchronization and audio mix.
19. Repeat at 1080p and confirm the output is not a black/empty placeholder.
20. Test one unsupported/corrupt input; the editor must show a clear error and must not report a fake successful export.

## Cloud
21. Sign in with a Supabase email/password account.
22. Save the same project twice; confirm the second save updates media metadata instead of failing on duplicate IDs.
23. Open the project from Cloud and verify all media are restored locally.
24. Sign out, sign in again, and verify the Cloud project list is scoped to the signed-in account.
25. Test a file over 50 MiB; local editing should still work and Cloud sync should report the skipped asset clearly.

## Known limits
- AI auto-captions, TTS, background removal and motion tracking are not implemented in this phase.
- Cloud Storage is limited to 50 MiB per media file.
- A video source's embedded audio is previewed; use **Tách audio** to add that sound as a separate exportable audio track.
