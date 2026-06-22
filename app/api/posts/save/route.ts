import { NextRequest, NextResponse } from 'next/server';
import { getStorageService } from '@/lib/services/storage.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 블로그 글 저장 API
 *
 * POST /api/posts/save
 *
 * FormData:
 * - post: string (생성된 블로그 글)
 * - photoAnalysis: string (JSON)
 * - styleProfile: string (JSON)
 * - blogUrls: string[] (블로그 URL들)
 * - images: File[] (원본 이미지들)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const finalPost = formData.get('post') as string;
    const photoAnalysisStr = formData.get('photoAnalysis') as string;
    const styleProfileStr = formData.get('styleProfile') as string;

    if (!finalPost) {
      return NextResponse.json({ error: '블로그 글이 없습니다.' }, { status: 400 });
    }

    // blogUrls 추출
    const blogUrls: string[] = [];
    formData.forEach((value, key) => {
      if (key === 'blogUrls' && typeof value === 'string' && value) {
        blogUrls.push(value);
      }
    });

    // images 추출 (async 처리)
    const images: Array<{ name: string; buffer: Buffer; type: string }> = [];
    for (const [key, value] of formData.entries()) {
      if (key === 'images' && value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        images.push({
          name: value.name,
          buffer,
          type: value.type,
        });
      }
    }

    // processedImages는 이미 위에서 비동기 처리 완료
    const processedImages = images;

    // 저장소에 저장
    const storage = getStorageService();
    const id = await storage.savePost({
      finalPost,
      photoAnalysis: photoAnalysisStr ? JSON.parse(photoAnalysisStr) : null,
      styleProfile: styleProfileStr ? JSON.parse(styleProfileStr) : null,
      blogUrls,
      images: processedImages,
    });

    console.log('[API] 글 저장 완료:', id);
    return NextResponse.json({ id });
  } catch (error) {
    console.error('[API] 글 저장 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
