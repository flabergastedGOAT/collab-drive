import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

const createSchema = z.object({ name: z.string().min(1).max(100) });

function generateInviteToken() {
  return randomBytes(24).toString('base64url');
}

export async function GET() {
  try {
    const session = await requireAuth();
    const memberships = await db.spaceMember.findMany({
      where: { userId: session.userId },
      include: {
        space: {
          include: {
            owner: { select: { id: true, name: true, rollNo: true } },
            _count: { select: { files: true, members: true } },
          },
        },
      },
    });
    const spaces = memberships.map((m) => ({
      id: m.space.id,
      name: m.space.name,
      role: m.role,
      owner: m.space.owner,
      fileCount: m.space._count.files,
      memberCount: m.space._count.members,
      createdAt: m.space.createdAt,
    }));
    return NextResponse.json(spaces);
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to fetch spaces' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { name } = createSchema.parse(body);
    const inviteToken = generateInviteToken();
    const space = await db.space.create({
      data: {
        name,
        ownerId: session.userId,
        inviteToken,
        members: {
          create: { userId: session.userId, role: 'admin' },
        },
      },
      include: { owner: { select: { id: true, name: true, rollNo: true } }, _count: { select: { files: true, members: true } } },
    });
    await db.activityLog.create({
      data: { spaceId: space.id, userId: session.userId, action: 'space_create', target: name },
    });
    return NextResponse.json({
      id: space.id,
      name: space.name,
      role: 'admin',
      owner: space.owner,
      fileCount: space._count.files,
      memberCount: space._count.members,
      createdAt: space.createdAt,
    });
  } catch (e) {
    if ((e as Error).message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create space' }, { status: 500 });
  }
}
