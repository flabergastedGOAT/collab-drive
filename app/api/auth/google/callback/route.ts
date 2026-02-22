import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/google-oauth';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', req.url));
  }
  try {
    const { refresh_token } = await getTokensFromCode(code);
    const envPath = resolve(process.cwd(), '.env');
    let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

    const line = `GOOGLE_DRIVE_REFRESH_TOKEN="${refresh_token}"`;
    if (envContent.includes('GOOGLE_DRIVE_REFRESH_TOKEN=')) {
      envContent = envContent.replace(/GOOGLE_DRIVE_REFRESH_TOKEN=.*/g, line);
    } else {
      envContent = envContent.trimEnd() + (envContent ? '\n' : '') + line + '\n';
    }
    writeFileSync(envPath, envContent);

    return NextResponse.redirect(new URL('/?setup=success', req.url));
  } catch (e) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent((e as Error).message)}`, req.url));
  }
}
