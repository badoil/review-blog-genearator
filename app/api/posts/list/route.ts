import { NextRequest, NextResponse } from 'next/server';
import { getStorageService } from '@/lib/services/storage.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 저장된 글 목록 API
 *
 * GET /api/posts/list
 */
export async function GET(request: NextRequest) {
  try {
    const storage = getStorageService();
    const posts = await storage.listPosts();

    return NextResponse.json(posts);
  } catch (error) {
    console.error('[API] 글 목록 조회 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
