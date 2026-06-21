import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 네이버 블로그 로그인 API
 *
 * POST /api/naver/login
 *
 * 브라우저를 열고 사용자가 수동으로 로그인하도록 합니다.
 * 로그인이 완료되면 세션을 저장합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const { getNaverBlogService } = await import('@/lib/services/naver.service');
    const naverService = getNaverBlogService();

    // 로그인 (브라우저가 열리고 사용자가 수동으로 로그인)
    await naverService.login();

    // 세션 저장
    const sessionPath = './naver-session.json';
    await naverService.saveSession(sessionPath);

    return NextResponse.json({
      success: true,
      message: '로그인이 완료되고 세션이 저장되었습니다.',
    });
  } catch (error) {
    console.error('네이버 로그인 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
