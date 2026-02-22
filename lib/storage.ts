import { google } from 'googleapis';
import { Readable } from 'stream';
import { getOAuth2Client } from './google-oauth';

const ALLOWED_MIME = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'text/plain', 'text/csv', 'application/json', 'application/zip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4', 'audio/mpeg', 'application/octet-stream'
]);

const MAX_SIZE = 200 * 1024 * 1024; // 200MB

function getAuth() {
  return getOAuth2Client();
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255) || 'file';
}

const DRIVE_OPTS = { supportsAllDrives: true };

export async function ensureRootFolder(): Promise<string> {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (rootFolderId) return rootFolderId;

  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.list({
    q: "name='CollabDrive' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id)',
    ...DRIVE_OPTS,
  });
  if (res.data.files?.length) return res.data.files[0].id!;
  const folder = await drive.files.create({
    requestBody: { name: 'CollabDrive', mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
    ...DRIVE_OPTS,
  });
  return folder.data.id!;
}

export async function getSpaceFolder(spaceId: string): Promise<string> {
  const rootId = await ensureRootFolder();
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list({
    q: `'${rootId}' in parents and name='${spaceId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    ...DRIVE_OPTS,
  });
  if (res.data.files?.length) return res.data.files[0].id!;
  const folder = await drive.files.create({
    requestBody: {
      name: spaceId,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootId],
    },
    fields: 'id',
    ...DRIVE_OPTS,
  });
  return folder.data.id!;
}

export async function uploadFile(
  spaceId: string,
  fileName: string,
  mimeType: string,
  size: number,
  stream: Readable | ReadableStream<Uint8Array>
): Promise<string> {
  if (size > MAX_SIZE) throw new Error('File too large (max 200MB)');
  const allowed = !mimeType || mimeType === 'application/octet-stream' || ALLOWED_MIME.has(mimeType) ||
    /^(image|text|application|video|audio)\//.test(mimeType);
  if (!allowed) throw new Error('File type not allowed');
  const parentId = await getSpaceFolder(spaceId);
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const body = stream instanceof Readable ? stream : Readable.fromWeb(stream as any);
  const file = await drive.files.create({
    requestBody: {
      name: sanitizeFileName(fileName),
      parents: [parentId],
    },
    media: { mimeType, body },
    fields: 'id',
    ...DRIVE_OPTS,
  });
  return file.data.id!;
}

export async function downloadFile(storageId: string): Promise<{ stream: Readable; mimeType: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const meta = await drive.files.get({ fileId: storageId, fields: 'mimeType', ...DRIVE_OPTS });
  const res = await drive.files.get(
    { fileId: storageId, alt: 'media', ...DRIVE_OPTS },
    { responseType: 'stream' }
  );
  return { stream: res.data as Readable, mimeType: meta.data.mimeType || 'application/octet-stream' };
}

export async function deleteFile(storageId: string): Promise<void> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.delete({ fileId: storageId, ...DRIVE_OPTS });
}

export async function deleteSpaceFolder(spaceId: string): Promise<void> {
  const rootId = await ensureRootFolder();
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list({
    q: `'${rootId}' in parents and name='${spaceId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    ...DRIVE_OPTS,
  });
  if (res.data.files?.length) {
    await drive.files.delete({ fileId: res.data.files[0].id!, ...DRIVE_OPTS });
  }
}
