# Upload Storage — Local Server

All media uploads (images, videos, audio, documents) are stored on the server's local disk and served as static files.

## How It Works

1. Client sends file via `POST /api/upload`
2. Server saves file to `./uploads/{folder}/{timestamp}-{random}.{ext}`
3. Server returns `{ url, filename }` where `url` is the full public URL
4. Files are served statically at `/uploads/...` via Express static middleware

## Folder Structure

```
uploads/
├── general/      # Chat media (images, videos, audio, docs)
├── avatars/      # Profile pictures
├── status/       # Status/story uploads
└── ...           # Other folders as needed
```

## Configuration

### `BASE_URL` (in `.env`)

Controls the base of all returned file URLs.

| Environment | Value |
|-------------|-------|
| Local dev   | `http://localhost:4000` |
| Ngrok       | `https://abc123.ngrok-free.app` |
| Production  | `https://your-domain.com` |

When using ngrok for mobile testing, update `BASE_URL` to the ngrok URL so the app can reach the files.

## Switching Back to Cloudinary

To revert to Cloudinary storage:

1. Restore the old `upload.service.ts` (uses `cloudinary` package + `v2.uploader.upload_stream`)
2. Ensure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` are in `.env`
3. Remove the `express.static('/uploads', ...)` line from `main.ts`
