import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_PATH = path.join(process.cwd(), 'naver-session.json');

/**
 * 네이버 블로그 업로드 API
 *
 * POST /api/naver/upload
 *
 * FormData:
 * - post: string (생성된 블로그 글)
 * - images: File[] (업로드할 이미지들, optional)
 *
 * 저장된 세션이 있으면 자동으로 사용하고,
 * 없으면 로그인이 필요하다는 에러를 반환합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const post = formData.get('post') as string;

    if (!post) {
      return NextResponse.json({ error: '블로그 글이 없습니다.' }, { status: 400 });
    }

    // 세션 파일 존재 확인
    if (!existsSync(SESSION_PATH)) {
      return NextResponse.json(
        {
          error: '로그인이 필요합니다.',
          needLogin: true,
          message: '먼저 /api/naver/login을 호출하여 로그인해주세요.',
        },
        { status: 401 }
      );
    }

    // 이미지 추출 및 저장
    const imagePaths: string[] = [];
    const uploadsDir = path.join(process.cwd(), 'uploads');

    // uploads 디렉토리 생성
    if (!existsSync(uploadsDir)) {
      await fs.promises.mkdir(uploadsDir, { recursive: true });
    }

    // 이미지 처리
    for (const [key, value] of formData.entries()) {
      if (key === 'images' && value instanceof File) {
        const fileName = `${Date.now()}-${value.name}`;
        const filePath = path.join(uploadsDir, fileName);

        // 파일 저장
        const buffer = Buffer.from(await value.arrayBuffer());
        await fs.promises.writeFile(filePath, buffer);

        imagePaths.push(filePath);
        console.log('[Naver Upload] 이미지 저장:', filePath);
      }
    }

    // 네이버 블로그 서비스로 업로드
    const { getNaverBlogService } = await import('@/lib/services/naver.service');
    const naverService = getNaverBlogService();

    // 저장된 세션 로드
    await naverService.loadSession(SESSION_PATH);

    // 글 파싱 (제목, 본문, 태그 추출)
    const { title, content, tags } = parseBlogPost(post);

    // 업로드 (이미지 포함)
    const uploadResult = await naverService.uploadPost(
      {
        title,
        content,
        tags,
      },
      { imagePaths }
    );

    // 업로드 후 임시 파일 삭제
    for (const imagePath of imagePaths) {
      try {
        await fs.promises.unlink(imagePath);
        console.log('[Naver Upload] 임시 파일 삭제:', imagePath);
      } catch (e) {
        console.log('[Naver Upload] 파일 삭제 실패:', imagePath, e);
      }
    }

    return NextResponse.json(uploadResult);
  } catch (error) {
    console.error('네이버 업로드 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

/**
 * 블로그 글 파싱
 * 제목, 본문, 태그를 추출합니다.
 */
function parseBlogPost(post: string): {
  title: string;
  content: string;
  tags: string[];
} {
  // 제목 추출 (#로 시작하는 첫 번째 줄)
  const titleMatch = post.match(/^#\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : '제목 없음';

  // 태그 추출 (태그: 부분)
  const tagsMatch = post.match(/태그:\s*(.+)/m);
  const tags = tagsMatch
    ? tagsMatch[1].split('#').map((t) => t.trim()).filter(Boolean)
    : [];

  // 본문 (제목과 태그 제외)
  const content = post
    .replace(/^#\s*.+$/m, '')
    .replace(/태그:\s*.+/m, '')
    .trim();

  return { title, content, tags };
}
