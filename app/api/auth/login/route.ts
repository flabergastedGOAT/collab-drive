import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createToken, setAuthCookie } from '@/lib/auth';

const schema = z.object({ rollNo: z.string().min(1), password: z.string() });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rollNo, password } = schema.parse(body);
    const user = await db.user.findUnique({ where: { rollNo } });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const token = await createToken({ userId: user.id, rollNo: user.rollNo });
    const res = NextResponse.json({ user: { id: user.id, rollNo: user.rollNo, name: user.name } });
    res.headers.set('Set-Cookie', setAuthCookie(token));
    return res;
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
