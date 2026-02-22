import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageMembers } from '@/lib/roles';
import { emitToSpace } from '@/lib/socket-emit';

async function getMember(spaceId: string, userId: string) {
  return db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } });
}

const roleSchema = z.object({ role: z.enum(['admin', 'member', 'viewer']) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const session = await requireAuth();
    const { id, memberId } = await params;
    const member = await getMember(id, session.userId);
    if (!member || !canManageMembers(member.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const target = await db.spaceMember.findFirst({ where: { id: memberId, spaceId: id }, include: { user: true } });
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    const body = await req.json();
    const { role } = roleSchema.parse(body);
    await db.spaceMember.update({ where: { id: memberId }, data: { role } });
    await db.activityLog.create({
      data: { spaceId: id, userId: session.userId, action: 'member_role', target: target.user.rollNo, metadata: JSON.stringify({ role }) },
    });
    emitToSpace(id, 'members', {});
    emitToSpace(id, 'activity', { action: 'member_role', target: target.user.rollNo });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const session = await requireAuth();
    const { id, memberId } = await params;
    const member = await getMember(id, session.userId);
    if (!member || !canManageMembers(member.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const target = await db.spaceMember.findFirst({ where: { id: memberId, spaceId: id }, include: { user: true } });
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (target.role === 'admin') {
      const adminCount = await db.spaceMember.count({ where: { spaceId: id, role: 'admin' } });
      if (adminCount <= 1) return NextResponse.json({ error: 'Cannot remove last admin' }, { status: 400 });
    }
    await db.spaceMember.delete({ where: { id: memberId } });
    await db.activityLog.create({
      data: { spaceId: id, userId: session.userId, action: 'member_remove', target: target.user.rollNo },
    });
    emitToSpace(id, 'members', {});
    emitToSpace(id, 'activity', { action: 'member_remove', target: target.user.rollNo });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Remove failed' }, { status: 500 });
  }
}
