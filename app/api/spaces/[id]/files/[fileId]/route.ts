import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canDelete } from '@/lib/roles';
import { downloadFile, deleteFile } from '@/lib/storage';
import { emitToSpace } from '@/lib/socket-emit';

async function getMember(spaceId: string, userId: string) {
  return db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } });
}

function canAccessFile(member: { role: string }, space: { membersOwnFilesOnly: boolean }, file: { uploadedById: string | null }, userId: string): boolean {
  if (member.role === 'admin') return true;
  if (space.membersOwnFilesOnly) return file.uploadedById === userId;
  return true;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const session = await requireAuth();
    const { id, fileId } = await params;
    const member = await getMember(id, session.userId);
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const space = await db.space.findUnique({ where: { id }, select: { membersOwnFilesOnly: true } });
    const file = await db.file.findFirst({ where: { id: fileId, spaceId: id } });
    if (!file || !space) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    if (!canAccessFile(member, space, file, session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { stream, mimeType } = await downloadFile(file.storageId);
    const webStream = Readable.toWeb(stream as import('stream').Readable);
    return new NextResponse(webStream as any, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
      },
    });
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}

const renameSchema = z.object({ name: z.string().min(1).max(255) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const session = await requireAuth();
    const { id, fileId } = await params;
    const member = await getMember(id, session.userId);
    if (!member || !canDelete(member.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const space = await db.space.findUnique({ where: { id }, select: { membersOwnFilesOnly: true } });
    const file = await db.file.findFirst({ where: { id: fileId, spaceId: id } });
    if (!file || !space) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    if (!canAccessFile(member, space, file, session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const { name } = renameSchema.parse(body);
    const updated = await db.file.update({
      where: { id: fileId },
      data: { name },
    });
    await db.activityLog.create({
      data: { spaceId: id, userId: session.userId, action: 'rename', target: name, metadata: JSON.stringify({ from: file.name }) },
    });
    const fileData = { id: updated.id, name: updated.name, mimeType: updated.mimeType, size: updated.size, createdAt: updated.createdAt, updatedAt: updated.updatedAt, uploadedById: updated.uploadedById };
    emitToSpace(id, 'files', fileData);
    emitToSpace(id, 'activity', { action: 'rename', target: name });
    return NextResponse.json(fileData);
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Rename failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const session = await requireAuth();
    const { id, fileId } = await params;
    const member = await getMember(id, session.userId);
    if (!member || !canDelete(member.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const space = await db.space.findUnique({ where: { id }, select: { membersOwnFilesOnly: true } });
    const file = await db.file.findFirst({ where: { id: fileId, spaceId: id } });
    if (!file || !space) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    if (!canAccessFile(member, space, file, session.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await deleteFile(file.storageId);
    await db.file.delete({ where: { id: fileId } });
    await db.activityLog.create({
      data: { spaceId: id, userId: session.userId, action: 'delete', target: file.name },
    });
    emitToSpace(id, 'fileDeleted', { id: fileId });
    emitToSpace(id, 'activity', { action: 'delete', target: file.name });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
