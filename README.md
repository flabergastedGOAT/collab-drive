# CollabDrive

A lightweight, minimal, production-ready web application for collaborative file sharing and management. Optimized for small teams, classrooms, or groups.

## Features

- **Auth**: Sign up, log in, secure JWT sessions
- **Spaces**: Create and join shared spaces
- **Files**: Upload, download, rename, delete (max 200MB per file)
- **Members**: Invite/remove members with roles (admin, member, viewer)
- **Activity**: Real-time activity log
- **Settings**: Rename space, manage members, delete space (admins only)
- **Theme**: Light/dark mode toggle
- **Real-time**: WebSocket updates for files, members, and activity

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: SQLite + Prisma
- **Storage**: Google Drive (via OAuth - your personal account)
- **Real-time**: Socket.io

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"
```

### 3. Google Drive (OAuth - Personal Account)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable **Google Drive API**
3. Create credentials → **OAuth client ID** (Web application)
4. Add redirect URI: `http://localhost:3000/api/auth/google/callback`
5. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env` (from the OAuth client)
6. **One-time setup**: Visit [http://localhost:3000/api/auth/google/setup](http://localhost:3000/api/auth/google/setup), sign in with your Google account, and approve access. The refresh token will be saved to `.env`
7. Restart the server. All uploads will go to your personal Google Drive (in a `CollabDrive` folder)

### 4. Database

```bash
npm run db:push
npm run db:seed
```

If you already had a database with the old schema (email-based auth), run `npx prisma db push --force-reset` then `npm run db:seed` to reset and use roll-number auth.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Seed accounts**: `SP25-BCS-064-A` / `password123` and `SP25-BCS-064-B` / `password123` (roll number + password)

## Deploy on Vercel (minimal free-tier usage)

The app is set up to run on Vercel without a custom server: real-time falls back to **polling** and the build uses **PostgreSQL** (SQLite is not supported on serverless).

1. **Database**: Use a free Postgres DB (e.g. [Neon](https://neon.tech) or Vercel Postgres). Create a project and copy the connection string (use the **pooled** URL if offered to avoid exhausting connections).

2. **Environment variables** in Vercel:
   - `DATABASE_URL` — PostgreSQL connection string (required on Vercel)
   - `JWT_SECRET` — min 32 characters
   - `NEXT_PUBLIC_APP_URL` — your Vercel URL (e.g. `https://your-app.vercel.app`)
   - `NEXT_PUBLIC_USE_POLLING` — set to `true` so the client uses polling instead of WebSockets (no Socket.io server on Vercel). This also keeps the client bundle smaller.
   - Add Google Drive vars if you use file uploads: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, and optionally `GOOGLE_APPLICATION_CREDENTIALS` (or use server env for service account JSON).

3. **Build**: Vercel runs `npm run build`, which uses `scripts/vercel-build.js` to run `prisma generate` with `prisma/schema.postgres.prisma` when `VERCEL` is set, then `next build`. No custom server is used.

4. **After first deploy**: Run migrations against your Postgres DB (e.g. from your machine with `DATABASE_URL` set to the same URL):
   ```bash
   npx prisma db push --schema=prisma/schema.postgres.prisma
   npx prisma db seed
   ```
   Or use Neon’s SQL editor to run migrations if you use migration files.

**Resource-saving behavior**: Polling interval is ~50s when using `NEXT_PUBLIC_USE_POLLING=true`, so serverless invocations stay low. Socket.io-client is not loaded when polling is enabled, reducing client bundle size.

## Production (self-hosted)

```bash
npm run build
npm start
```

Set `NODE_ENV=production` and ensure all env vars are configured. For local/self-hosted you can keep SQLite and the default build; use `node server.js` for WebSocket support.

## Project Structure

```
├── app/
│   ├── api/           # API routes (auth, spaces, files, members, activity)
│   ├── dashboard/     # Dashboard & space pages
│   └── page.tsx       # Login/signup
├── components/        # Theme provider
├── lib/               # db, auth, storage, socket
├── prisma/            # Schema & seed
└── server.js          # Custom server (Next.js + Socket.io)
```

## Security

- All actions require authentication
- Role-based access (admin/member/viewer)
- File names sanitized, MIME types validated
- Upload rate limit (20/hour per user)
- Google Drive IDs never exposed to clients
- HttpOnly cookies for JWT
