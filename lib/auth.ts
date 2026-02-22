import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-min-32-characters-long'
);

export type JWTPayload = { userId: string; rollNo: string };

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<JWTPayload> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  return session;
}

export function setAuthCookie(token: string) {
  return `auth=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`;
}

export function clearAuthCookie() {
  return `auth=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
