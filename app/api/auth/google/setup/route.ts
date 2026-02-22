import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-oauth';

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
