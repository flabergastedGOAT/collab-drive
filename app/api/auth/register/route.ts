import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createToken, setAuthCookie } from '@/lib/auth';

const schema = z.object({ rollNo: z.string().min(1).max(50), password: z.string().min(6), name: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rollNo, password, name } = schema.parse(body);
    const existing = await db.user.findUnique({ where: { rollNo } });
    if (existing) return NextResponse.json({ error: 'Roll number already registered' }, { status: 400 });
    const hashed = await bcrypt.hash(password, 10);
    const user = await db.user.create({ data: { rollNo, password: hashed, name } });
    const token = await createToken({ userId: user.id, rollNo: user.rollNo });
    const res = NextResponse.json({ user: { id: user.id, rollNo: user.rollNo, name: user.name } });
    res.headers.set('Set-Cookie', setAuthCookie(token));
    return res;
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
