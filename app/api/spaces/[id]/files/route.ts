import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canUpload, type Role } from '@/lib/roles';
import { uploadFile } from '@/lib/storage';
import { checkUploadRateLimit } from '@/lib/rateLimit';
import { emitToSpace } from '@/lib/socket-emit';

async function getMember(spaceId: string, userId: string) {
  return db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const member = await getMember(id, session.userId);
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const files = await db.file.findMany({
      where: { spaceId: id },
      orderBy: { updatedAt: 'desc' },
    });
    const space = await db.space.findUnique({ where: { id }, select: { membersOwnFilesOnly: true } });
    const membersOwnOnly = space?.membersOwnFilesOnly ?? false;
    return NextResponse.json(
      files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        uploadedById: f.uploadedById ?? null,
      }))
    );
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const member = await getMember(id, session.userId);
    if (!member || !canUpload(member.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!checkUploadRateLimit(session.userId)) return NextResponse.json({ error: 'Upload rate limit exceeded' }, { status: 429 });
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    const storageId = await uploadFile(id, file.name, file.type, file.size, file.stream());
    const f = await db.file.create({
      data: {
        spaceId: id,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        storageId,
        uploadedById: session.userId,
      },
    });
    await db.activityLog.create({
      data: { spaceId: id, userId: session.userId, action: 'upload', target: file.name },
    });
    const fileData = { id: f.id, name: f.name, mimeType: f.mimeType, size: f.size, createdAt: f.createdAt, updatedAt: f.updatedAt, uploadedById: f.uploadedById };
    emitToSpace(id, 'files', fileData);
    emitToSpace(id, 'activity', { action: 'upload', target: file.name });
    return NextResponse.json(fileData);
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message || 'Upload failed' }, { status: 500 });
  }
}
