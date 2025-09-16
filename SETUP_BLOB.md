# Setting up Vercel Blob Storage for Sploot

## Overview

Vercel Blob is a serverless object storage solution that integrates seamlessly with Vercel deployments. It's perfect for storing user-uploaded images in Sploot.

## Setup Instructions

### 1. Enable Blob Storage in Vercel

1. **Deploy to Vercel** (if not already done):
   ```bash
   npx vercel
   ```

2. **Enable Blob Storage**:
   - Go to your project in the [Vercel Dashboard](https://vercel.com/dashboard)
   - Navigate to the "Storage" tab
   - Click "Create Database"
   - Select "Blob" as the storage type
   - Choose a name (e.g., "sploot-images")
   - Select your preferred region

3. **Get your Blob token**:
   - After creating the Blob store, go to the "Settings" tab
   - Copy the `BLOB_READ_WRITE_TOKEN`

### 2. Configure Environment Variables

Update your `.env.local` file:
```env
BLOB_READ_WRITE_TOKEN=vercel_blob_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

For production (in Vercel Dashboard):
- Go to Project Settings → Environment Variables
- Add `BLOB_READ_WRITE_TOKEN` with the value from step 1

### 3. Test the Configuration

1. Start the development server:
   ```bash
   pnpm dev
   ```

2. Navigate to http://localhost:3000/app (after signing in)

3. Use the "Blob Storage Test" component to:
   - Select an image file (JPEG, PNG, WebP, or GIF)
   - Click upload to generate a pre-signed URL
   - Verify you get a successful response

## How It Works

### Upload Flow

1. **Client requests upload URL**:
   - Client sends filename, MIME type, and size to `/api/upload-url`
   - Server validates the request and generates a unique filename

2. **Server generates pre-signed URL**:
   - Server creates a secure, time-limited upload URL
   - Returns URL and upload configuration to client

3. **Client uploads directly to Blob**:
   - Client uploads file directly to Vercel Blob storage
   - Bypasses server, enabling large file uploads

4. **Server processes metadata** (in next task):
   - After successful upload, client notifies server
   - Server stores metadata in database

### File Organization

Files are organized by user ID and timestamp:
```
{userId}/{timestamp}-{random}.{extension}

Example:
user_123abc/1703123456789-x7b9k2.jpg
```

## Features Implemented

✅ File type validation (JPEG, PNG, WebP, GIF)
✅ File size validation (max 10MB)
✅ Unique filename generation
✅ User-scoped file organization
✅ Pre-signed URL generation
✅ Authentication checks

## Troubleshooting

### "Blob storage not configured" message
- Ensure `BLOB_READ_WRITE_TOKEN` is set in `.env.local`
- Verify the token starts with `vercel_blob_`

### Upload fails with 401 Unauthorized
- Check that you're signed in
- Verify Clerk authentication is working

### File type not accepted
- Only image files (JPEG, PNG, WebP, GIF) are allowed
- Check the file extension and MIME type

### File too large error
- Maximum file size is 10MB
- Consider compressing images before upload

## Next Steps

After Blob storage is configured:
1. Set up PostgreSQL database with pgvector (M1.2)
2. Implement the `/api/assets` endpoint for metadata storage (M1.4)
3. Add image embedding generation (M2.1)

## Cost Considerations

- **Free tier**: 1GB storage, 1GB bandwidth per month
- **Pro tier**: Pay-as-you-go pricing
- **Optimization tips**:
  - Implement image compression before upload
  - Set appropriate cache headers
  - Consider image optimization with Vercel's Image Optimization API

## Security Notes

- All uploads require authentication via Clerk
- Files are organized by user ID for isolation
- Pre-signed URLs expire after a short time
- Consider adding virus scanning for production