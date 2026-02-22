import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { emitToSpace } from '@/lib/socket-emit';

const joinSchema = z.object({ token: z.string().min(1) });

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });
  try {
    const space = await db.space.findUnique({
      where: { inviteToken: token },
      select: { id: true, name: true, defaultJoinRole: true },
    });
    if (!space) return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
    return NextResponse.json({ spaceName: space.name, role: space.defaultJoinRole });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch invite' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { token } = joinSchema.parse(body);
    const space = await db.space.findUnique({
      where: { inviteToken: token },
      select: { id: true, name: true, defaultJoinRole: true },
    });
    if (!space) return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
    const existing = await db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId: space.id, userId: session.userId } } });
    if (existing) return NextResponse.json({ error: 'You are already a member', spaceId: space.id }, { status: 400 });
    await db.spaceMember.create({ data: { spaceId: space.id, userId: session.userId, role: space.defaultJoinRole } });
    await db.activityLog.create({
      data: { spaceId: space.id, userId: session.userId, action: 'member_add', target: 'via invite link', metadata: JSON.stringify({ role: space.defaultJoinRole }) },
    });
    emitToSpace(space.id, 'members', {});
    emitToSpace(space.id, 'activity', { action: 'member_add', target: 'via invite link' });
    return NextResponse.json({ spaceId: space.id, spaceName: space.name });
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
