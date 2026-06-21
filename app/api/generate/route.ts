import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 블로그 글 생성 API
 *
 * POST /api/generate
 *
 * Body (FormData):
 * - images: File[] (업로드된 이미지들)
 * - blogUrls: string[] (네이버 블로그 URL들)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[API] 블로그 생성 요청 시작');

    const formData = await request.formData();

    // 이미지 추출
    const images: File[] = [];
    formData.forEach((value, key) => {
      if (key === 'images' && value instanceof File) {
        images.push(value);
      }
    });

    // 블로그 URL 추출
    const blogUrls: string[] = [];
    formData.forEach((value, key) => {
      if (key === 'blogUrls' && typeof value === 'string' && value) {
        blogUrls.push(value);
      }
    });

    console.log('[API] 입력 데이터 - 이미지:', images.length, 'URL:', blogUrls.length);

    if (images.length === 0) {
      return NextResponse.json({ error: '이미지가 없습니다.' }, { status: 400 });
    }

    if (blogUrls.length === 0) {
      return NextResponse.json({ error: '블로그 URL이 필요합니다.' }, { status: 400 });
    }

    // 이미지를 base64로 변환
    console.log('[API] 이미지 base64 변환 시작');
    const imagePromises = images.map(async (img) => {
      const buffer = Buffer.from(await img.arrayBuffer());
      const base64 = `data:${img.type};base64,${buffer.toString('base64')}`;
      return {
        path: img.name,
        base64,
      };
    });
    const imageObjects = await Promise.all(imagePromises);
    console.log('[API] 이미지 변환 완료:', imageObjects.length);

    // LangGraph로 블로그 생성
    console.log('[API] 그래프 실행 시작');
    const { generateBlogPost } = await import('@/lib/agent/graph');
    const result = await generateBlogPost(imageObjects, blogUrls);
    console.log('[API] 그래프 실행 완료');

    if (result.error) {
      console.error('[API] 그래프 실행 에러:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log('[API] 블로그 생성 성공');
    return NextResponse.json({
      photoAnalysis: result.photoAnalysis,
      styleProfile: result.styleProfile,
      draft: result.draft,
      finalPost: result.finalPost,
      images: imageObjects,  // 이미지 정보 추가 (미리보기용)
      imagePlacements: result.imagePlacements,  // 이미지 배치 정보
    });
  } catch (error) {
    console.error('[API] 블로그 생성 오류:', error);
    if (error instanceof Error) {
      console.error('[API] 스택 트레이스:', error.stack);
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
