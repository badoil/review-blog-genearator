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

  // imagePlacements가 있는 경우: 섹션별 이미지 배치
  if (imagePlacements && imagePlacements.length > 0) {
    console.log('[renderContentWithImages] imagePlacements 사용하여 섹션별 배치:', imagePlacements);

    const lines = content.split('\n');
    let html = '';
    let placementIndex = 0;

    lines.forEach((line) => {
      // 섹션 시작 패턴 감지 (볼드, 대괄호 모두 지원)
      if (line.match(/섹션\s+\d+:/) && placementIndex < imagePlacements.length) {
        const placement = imagePlacements[placementIndex];
        const groupImageIndices = placement.groupImageIndices || [placement.imageIndex];

        // 그룹에 속한 모든 이미지를 배치
        const groupImagesHtml = groupImageIndices.map((imgIdx: number) => {
          if (imgIdx < images.length) {
            const img = images[imgIdx];
            return `<img src="${img.base64}" alt="블로그 이미지" style="max-width: 200px !important; width: 100% !important; height: auto !important; object-fit: contain !important; border-radius: 12px !important; margin: 8px auto !important; display: inline-block !important;" />`;
          }
          return '';
        }).join(' ');

        // 이미지들을 감싸는 div
        html += `\n<div class="group-images" style="text-align: center; margin: 16px 0;">\n${groupImagesHtml}\n</div>\n\n`;
        placementIndex++;
      }

      // 섹션 텍스트 추가 (이미지 후에)
      html += line + '\n';
    });

    return html;
  }

  // imagePlacements가 없으면 이미지를 섹션 순서대로 배치
  const lines = content.split('\n');
  let html = '';
  let sectionIndex = 0;

  lines.forEach((line) => {
    // 섹션 시작 패턴을 감지하면 해당 섹션에 이미지를 먼저 추가
    if (line.match(/^(?:\[)?섹션\s+\d+/)) {
      if (sectionIndex < images.length) {
        const img = images[sectionIndex];
        html += `\n<img src="${img.base64}" alt="블로그 이미지" style="max-width: 200px !important; width: 100% !important; height: auto !important; object-fit: contain !important; border-radius: 12px !important; margin: 16px auto !important; display: block !important;" />\n\n`;
        sectionIndex++;
      }
    }

    // 섹션 텍스트 추가 (이미지 후에)
    html += line + '\n';
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

    // 정렬된 이미지 순서에 따라 imageObjects 재배열
    let sortedImageObjects = imageObjects;
    if (result.photoAnalysis?.sortedImageOrder) {
      console.log('[API] 카테고리 순서에 따라 imageObjects 재배열...');
      console.log('[API] sortedImageOrder:', result.photoAnalysis.sortedImageOrder);
      sortedImageObjects = result.photoAnalysis.sortedImageOrder.map(idx => imageObjects[idx]);
      console.log('[API] imageObjects 재배열 완료');
    }

    // 이미지와 글이 합쳐진 HTML 생성
    const finalContent = result.finalPost || result.draft || '';
    const contentWithImages = renderContentWithImages(
      finalContent,
      sortedImageObjects,
      result.imagePlacements || []
    );

    return NextResponse.json({
      photoAnalysis: result.photoAnalysis,
      styleProfile: result.styleProfile,
      draft: result.draft,
      finalPost: result.finalPost,
      finalContentWithImages: contentWithImages,  // 이미지 포함 HTML
      images: sortedImageObjects,  // 정렬된 순서의 이미지
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
