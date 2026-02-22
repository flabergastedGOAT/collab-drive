import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageSpace, type Role } from '@/lib/roles';

async function getMember(spaceId: string, userId: string) {
  return db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const member = await getMember(id, session.userId);
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    let space = await db.space.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, rollNo: true } },
        members: { include: { user: { select: { id: true, name: true, rollNo: true } } } },
      },
    });
    if (!space) return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    if (!space.inviteToken) {
      space = await db.space.update({
        where: { id },
        data: { inviteToken: randomBytes(24).toString('base64url') },
        include: {
          owner: { select: { id: true, name: true, rollNo: true } },
          members: { include: { user: { select: { id: true, name: true, rollNo: true } } } },
        },
      });
    }
    return NextResponse.json({
      ...space,
      myRole: member.role,
      myUserId: session.userId,
      membersOwnFilesOnly: space.membersOwnFilesOnly ?? false,
    });
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to fetch space' }, { status: 500 });
  }
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  membersOwnFilesOnly: z.boolean().optional(),
  defaultJoinRole: z.enum(['member', 'viewer']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const member = await getMember(id, session.userId);
    if (!member || !canManageSpace(member.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const parsed = updateSchema.parse(body);
    const space = await db.space.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.membersOwnFilesOnly !== undefined && { membersOwnFilesOnly: parsed.membersOwnFilesOnly }),
        ...(parsed.defaultJoinRole !== undefined && { defaultJoinRole: parsed.defaultJoinRole }),
      },
      include: { owner: { select: { id: true, name: true, rollNo: true } } },
    });
    if (parsed.name !== undefined) {
      await db.activityLog.create({
        data: { spaceId: id, userId: session.userId, action: 'space_rename', target: parsed.name },
      });
    }
    return NextResponse.json(space);
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Failed to update space' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const member = await getMember(id, session.userId);
    if (!member || !canManageSpace(member.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { deleteSpaceFolder } = await import('@/lib/storage');
    try {
      await deleteSpaceFolder(id);
    } catch {
      // Drive folder may not exist or may already be removed; still delete the space
    }
    await db.space.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to delete space' }, { status: 500 });
  }
}
