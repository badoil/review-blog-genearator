import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 이미지 배치 정보를 사용하여 텍스트와 이미지가 합쳐진 HTML 생성
 * 순서: 제목 → 이미지1 → 섹션1 → 이미지2 → 섹션2 → ...
 */
function renderContentWithImages(
  content: string,
  images: Array<{ path: string; base64: string }>,
  imagePlacements: any[]
): string {
  if (!images || images.length === 0) {
    return content;
  }

  // imagePlacements가 없으면 이미지를 섹션 순서대로 배치
  if (!imagePlacements || imagePlacements.length === 0) {
    // 간단한 경우: 이미지를 섹션별로 배치
    const lines = content.split('\n');
    let html = '';
    let sectionIndex = 0;

    lines.forEach((line) => {
      html += line + '\n';

      // 섹션 시작 패턴을 감지하면 해당 섹션에 이미지를 먼저 추가
      if (line.match(/^(?:\[)?섹션\s+\d+/) || line.match(/^#\s+/)) {
        // 첫 번째 #는 제목이므로 이미지를 추가하지 않음
        if (!line.match(/^#\s+/) && sectionIndex < images.length) {
          const img = images[sectionIndex];
          html += `\n<img src="${img.base64}" alt="블로그 이미지" style="max-width: 200px !important; width: 100% !important; height: auto !important; object-fit: contain !important; border-radius: 12px !important; margin: 16px auto !important; display: block !important;" />\n\n`;
          sectionIndex++;
        }
      }
    });

    return html;
  }

  // imagePlacements가 있는 경우: 섹션별 이미지 매핑
  // 간단한 매핑: 섹션 N → 이미지 N-1
  const lines = content.split('\n');
  let html = '';
  let sectionCount = 0;

  lines.forEach((line) => {
    html += line + '\n';

    // 섹션 시작 패턴 감지 (대괄호 선택적)
    if (line.match(/^(?:\[)?섹션\s+\d+/)) {
      sectionCount++;
      // 해당 섹션에 이미지 추가 (섹션 1 → 이미지 0)
      const imageIdx = sectionCount - 1;
      if (imageIdx < images.length) {
        const img = images[imageIdx];
        html += `\n<img src="${img.base64}" alt="블로그 이미지" style="max-width: 200px !important; width: 100% !important; height: auto !important; object-fit: contain !important; border-radius: 12px !important; margin: 16px auto !important; display: block !important;" />\n\n`;
      }
    }
  });

  return html;
}

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

    // 이미지와 글이 합쳐진 HTML 생성
    const finalContent = result.finalPost || result.draft || '';
    const contentWithImages = renderContentWithImages(
      finalContent,
      imageObjects,
      result.imagePlacements || []
    );

    return NextResponse.json({
      photoAnalysis: result.photoAnalysis,
      styleProfile: result.styleProfile,
      draft: result.draft,
      finalPost: result.finalPost,
      finalContentWithImages: contentWithImages,  // 이미지 포함 HTML
      images: imageObjects,
      imagePlacements: result.imagePlacements,
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
