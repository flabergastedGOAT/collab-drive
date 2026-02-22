import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

async function getMember(spaceId: string, userId: string) {
  return db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const member = await getMember(id, session.userId);
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const cursor = req.nextUrl.searchParams.get('cursor');
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 100);
    const activity = await db.activityLog.findMany({
      where: { spaceId: id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    const hasMore = activity.length > limit;
    const items = hasMore ? activity.slice(0, -1) : activity;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    const userIds = [...new Set(items.map((a) => a.userId))];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, rollNo: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const result = items.map((a) => ({
      id: a.id,
      action: a.action,
      target: a.target,
      metadata: a.metadata ? JSON.parse(a.metadata) : null,
      createdAt: a.createdAt,
      user: userMap[a.userId] || { id: a.userId, name: 'Unknown', rollNo: '' },
    }));
    return NextResponse.json({ items: result, nextCursor });
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
