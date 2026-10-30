# CapCut D-Social Studio

Trình chỉnh sửa video social độc lập, xây dựng bằng Next.js 14, React, Zustand và FFmpeg.wasm. Giao diện/kiến trúc tham khảo OpenCut; không phải bản fork hay bản sao nguyên trạng.

## Tính năng hiện có

| Nhóm | Chi tiết |
|---|---|
| Timeline | Nhiều track video/text/audio, kéo clip, đổi track, resize, split, xóa |
| History | Undo/Redo tối đa 50 bước |
| Text | Overlay tiếng Việt, font Noto Sans khi export |
| Fade/Transition | Fade In/Out, Dissolve, Fade, Slide |
| Audio | Volume theo clip/track, tách audio từ video |
| Export | MP4 720p/1080p bằng FFmpeg.wasm, có tiến trình |
| Local persistence | Metadata autosave và media gốc trong IndexedDB |
| Mobile | Giao diện tab Media / Preview / Chỉnh sửa, Timeline hỗ trợ pointer/touch |
| PWA | Web app manifest, viewport và biểu tượng cài đặt |

## Chạy local

Yêu cầu Node.js 20 trở lên và trình duyệt Chromium hiện đại.

```bash
npm install
npm run dev
```

Mở http://localhost:3000.

## Lưu trữ media và project

- File video/ảnh/âm thanh gốc được lưu vào IndexedDB theo asset ID.
- Metadata project được autosave vào localStorage mỗi 15 giây.
- Khi F5 hoặc mở lại project JSON trên cùng trình duyệt/cùng profile, ứng dụng tìm file gốc trong IndexedDB và tạo lại Blob URL.
- File `.cds.json` chỉ chứa cấu trúc project và metadata, không nhúng file media. Chuyển project sang thiết bị khác vẫn cần tải lại media hoặc dùng Cloud API.
- Xóa media khỏi thư viện cũng xóa blob tương ứng trong IndexedDB.

IndexedDB phụ thuộc dung lượng thiết bị và chính sách dọn dữ liệu của trình duyệt. Không coi đây là bản sao lưu lâu dài duy nhất.

## Supabase Cloud API

Migration: `supabase/migrations/20261030000100_editor_projects.sql`.

Thiết lập biến môi trường trong Vercel/local:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Không đưa `service_role` key vào trình duyệt hoặc repository. API dùng Supabase access token của người dùng trong header `Authorization: Bearer <access_token>`; RLS giới hạn dữ liệu theo `auth.uid()`.

Endpoints:
- `GET /api/projects` — danh sách project của người dùng.
- `POST /api/projects` — lưu/tạo project; JSON: `{ "id": "...", "title": "...", "projectData": { ... } }`.
- `GET /api/projects/:id` — đọc project.
- `PATCH /api/projects/:id` — cập nhật title/projectData.
- `DELETE /api/projects/:id` — xóa project.
- `GET /api/projects/:id/assets` — liệt kê media cloud.
- `POST /api/projects/:id/assets` — đăng ký metadata JSON sau khi browser upload file trực tiếp lên private Storage bucket. Client helper nằm ở `lib/cloud-projects.ts`; file lớn không đi qua Vercel Function.
- `GET /api/projects/:id/assets/:assetId` — tạo signed URL có thời hạn 1 giờ.

Các hàm `saveCloudProject`, `loadCloudProject`, `uploadCloudAsset`, `getCloudAssetUrl` và `deleteCloudAsset` nhận Supabase access token từ luồng đăng nhập của ứng dụng gọi chúng.
- `DELETE /api/projects/:id/assets/:assetId` — xóa file và metadata.

**Lưu ý:** API và schema đã được chuẩn bị; để bật Cloud Save end-to-end cần chạy migration trên đúng Supabase project, cấu hình URL/anon key và nối luồng đăng nhập Supabase để cấp access token. Repo hiện chưa có màn hình đăng nhập Supabase hoặc nút đồng bộ Cloud trong editor. Không dùng service-role key để né RLS.

## Kiểm tra CI

GitHub Actions workflow `.github/workflows/ci.yml` chạy `npm install` và `npm run build` khi push, pull request hoặc chạy thủ công.

## Kiểm thử trên Android

Xem [ANDROID-CHECKLIST.md](ANDROID-CHECKLIST.md). Chỉ đánh dấu đạt sau khi thực hiện trên thiết bị thật; CI build xanh không thay thế kiểm thử playback/touch/export.

## Phím tắt

- Ctrl/Cmd + Z — Undo
- Ctrl/Cmd + Y hoặc Ctrl/Cmd + Shift + Z — Redo
- Ctrl/Cmd + S — Save project JSON
- Delete / Backspace — Xóa clip đang chọn
- S — Split tại playhead

## Nguồn tham khảo

- [OpenCut](https://github.com/OpenCut-app/OpenCut) — dự án mới đang viết lại kiến trúc.
- [OpenCut Classic](https://github.com/OpenCut-app/opencut-classic) — mã nguồn cũ đã archived.
- OpenCut phát hành theo MIT License; dự án này chỉ tham khảo kiến trúc/UX và không tuyên bố là sản phẩm chính thức của OpenCut.

