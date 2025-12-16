# FIT File Storage Testing Guide

## Prerequisites
1. Supabase running: `supabase start`
2. Dev server running: `pnpm dev`
3. Logged in to the app at `http://localhost:3000`
4. Have a test FIT file ready (e.g., `test-activity.fit`)

## Test Flow

### 1. Upload FIT File(s)

**Using curl:**
```bash
# While logged in, copy session cookie from browser DevTools
# (Application → Cookies → sb-127-auth-token)

# Upload single file
curl -X POST http://localhost:3000/api/fit-files/upload \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN" \
  -F "files=@/path/to/your/activity.fit" \
  -v

# Upload multiple files
curl -X POST http://localhost:3000/api/fit-files/upload \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN" \
  -F "files=@/path/to/activity1.fit" \
  -F "files=@/path/to/activity2.fit" \
  -v
```

**Expected Response:**
```json
{
  "success": true,
  "filesUploaded": 1,
  "paths": ["<user-id>/activity.fit"]
}
```

### 2. List FIT Files

**URL:** http://localhost:3000/api/fit-files

**Using curl:**
```bash
curl http://localhost:3000/api/fit-files \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"
```

**Expected Response:**
```json
{
  "files": [
    {
      "name": "activity.fit",
      "size": 12345,
      "uploadedAt": "2025-12-15T12:34:56.789Z",
      "path": "<user-id>/activity.fit"
    }
  ],
  "count": 1
}
```

### 3. Download FIT File

**URL:** `GET /api/fit-files/download?filename=activity.fit`

**Using curl:**
```bash
# Get signed URL
curl "http://localhost:3000/api/fit-files/download?filename=activity.fit" \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"

# Response:
# {
#   "url": "https://<supabase-url>/storage/v1/object/sign/fit-files/<user-id>/activity.fit?token=...",
#   "expiresIn": 3600
# }

# Then download the file using the signed URL
curl -o downloaded-activity.fit "<signed-url>"
```

### 4. Delete FIT File

**URL:** `DELETE /api/fit-files?filename=activity.fit`

**Using curl:**
```bash
curl -X DELETE "http://localhost:3000/api/fit-files?filename=activity.fit" \
  -H "Cookie: sb-127-auth-token=YOUR_SESSION_TOKEN"
```

**Expected Response:**
```json
{
  "success": true
}
```

### 5. Verify in Supabase Storage

**Using Supabase CLI:**
```bash
# List storage buckets
supabase storage ls

# List files in fit-files bucket
supabase storage ls fit-files

# List files for specific user
supabase storage ls "fit-files/<user-id>"
```

**Using SQL:**
```sql
-- Connect to database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

-- Check storage bucket
SELECT * FROM storage.buckets WHERE id = 'fit-files';

-- Check uploaded files
SELECT
  name,
  bucket_id,
  owner,
  created_at,
  metadata
FROM storage.objects
WHERE bucket_id = 'fit-files'
ORDER BY created_at DESC;
```

## Troubleshooting

### Error: "Unauthorized"
- **Cause:** Not logged in to the app
- **Fix:** Log in at `http://localhost:3000` first

### Error: "All files must be FIT files"
- **Cause:** Uploaded file doesn't have .fit extension
- **Fix:** Rename file to have .fit extension or upload valid FIT file

### Error: "File not found"
- **Cause:** File doesn't exist or belongs to different user
- **Fix:** Check filename and ensure file was uploaded successfully

### Files not uploading
- **Check:** Storage bucket exists
  ```sql
  SELECT * FROM storage.buckets WHERE id = 'fit-files';
  ```
- **Check:** RLS policies are correct
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
  ```

## Storage Organization

Files are organized by user:
```
fit-files/
├── <user-id-1>/
│   ├── activity-2025-01-15.fit
│   ├── activity-2025-01-16.fit
│   └── ride-morning.fit
└── <user-id-2>/
    ├── workout-1.fit
    └── workout-2.fit
```

## Security Features

✅ Row-Level Security on storage.objects
✅ Users can only access their own files
✅ Files stored in user-specific folders
✅ Signed URLs for temporary access (default: 1 hour)
✅ File validation (.fit extension required)

## Success Indicators

✅ File uploads successfully
✅ File appears in list
✅ Signed URL downloads file correctly
✅ File deletion works
✅ Other users cannot access your files
✅ Storage bucket has correct RLS policies

## Next Steps

After successful FIT file storage:
- Integrate FIT file upload with Strava sync (download FIT files from Strava)
- Build UI for FIT file management
- Implement FIT file processing/analysis
