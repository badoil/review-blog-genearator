import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_PATH = path.join(process.cwd(), 'naver-session.json');

/**
 * 네이버 로그아웃 API
 *
 * POST /api/naver/logout
 *
 * 세션 파일을 삭제하여 로그아웃합니다.
 */
export async function POST() {
  try {
    // 세션 파일 삭제
    if (await fs.access(SESSION_PATH).then(() => true).catch(() => false)) {
      await fs.unlink(SESSION_PATH);
    }

    return NextResponse.json({
      success: true,
      message: '로그아웃되었습니다.',
    });
  } catch (error) {
    console.error('로그아웃 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
