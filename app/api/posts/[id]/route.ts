import { NextRequest, NextResponse } from 'next/server';
import { getStorageService } from '@/lib/services/storage.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 저장된 글 불러오기 API
 *
 * GET /api/posts/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const storage = getStorageService();
    const post = await storage.loadPost(id);

    if (!post) {
      return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error('[API] 글 불러오기 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

/**
 * 저장된 글 삭제 API
 *
 * DELETE /api/posts/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const storage = getStorageService();
    const success = await storage.deletePost(id);

    if (!success) {
      return NextResponse.json({ error: '글 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] 글 삭제 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
