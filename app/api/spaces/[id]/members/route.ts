import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageMembers } from '@/lib/roles';
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
    const members = await db.spaceMember.findMany({
      where: { spaceId: id },
      include: { user: { select: { id: true, name: true, rollNo: true } } },
    });
    return NextResponse.json(members.map((m) => ({ id: m.id, userId: m.userId, role: m.role, joinedAt: m.joinedAt, user: m.user })));
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

const inviteSchema = z.object({ rollNo: z.string().min(1).max(50), role: z.enum(['admin', 'member', 'viewer']) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const member = await getMember(id, session.userId);
    if (!member || !canManageMembers(member.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const { rollNo, role } = inviteSchema.parse(body);
    const user = await db.user.findUnique({ where: { rollNo } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const existing = await db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId: id, userId: user.id } } });
    if (existing) return NextResponse.json({ error: 'User already in space' }, { status: 400 });
    await db.spaceMember.create({ data: { spaceId: id, userId: user.id, role } });
    await db.activityLog.create({
      data: { spaceId: id, userId: session.userId, action: 'member_add', target: rollNo, metadata: JSON.stringify({ role }) },
    });
    emitToSpace(id, 'activity', { action: 'member_add', target: rollNo });
    const members = await db.spaceMember.findMany({
      where: { spaceId: id },
      include: { user: { select: { id: true, name: true, rollNo: true } } },
    });
    const memberList = members.map((m) => ({ id: m.id, userId: m.userId, role: m.role, joinedAt: m.joinedAt, user: m.user }));
    emitToSpace(id, 'members', memberList);
    return NextResponse.json(memberList);
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Invite failed' }, { status: 500 });
  }
}
