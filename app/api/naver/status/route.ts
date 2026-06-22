import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_PATH = path.join(process.cwd(), 'naver-session.json');

/**
 * 네이버 로그인 상태 확인 API
 *
 * GET /api/naver/status
 *
 * 세션 파일이 존재하는지 확인하여 로그인 상태를 반환합니다.
 */
export async function GET() {
  const isLoggedIn = existsSync(SESSION_PATH);

  return NextResponse.json({
    isLoggedIn,
    message: isLoggedIn ? '로그인됨' : '로그인 필요',
  });
}
