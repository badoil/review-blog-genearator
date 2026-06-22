import type { BlogState } from '../state';
import { getNaverBlogService } from '../../services/naver.service';

/**
 * Publisher Agent Node
 * 생성된 블로그 글을 네이버 블로그에 발행
 */
export async function publisherNode(state: BlogState): Promise<Partial<BlogState>> {
  const { draft, naverBlogId, images } = state;

  console.log('[Publisher Agent] 시작');
  console.log('[Publisher Agent] 글 존재:', draft ? '있음' : '없음');
  console.log('[Publisher Agent] 네이버 블로그 ID:', naverBlogId || '없음');
  console.log('[Publisher Agent] 이미지 개수:', images?.length || 0);

  if (!draft) {
    return {
      error: '발행할 글이 없습니다.',
    };
  }

  if (!naverBlogId) {
    return {
      error: '네이버 블로그 ID가 없습니다.',
    };
  }

  // 글 파싱 (제목, 본문, 태그 추출)
  const { title, content, tags } = parseBlogPost(draft);

  console.log('[Publisher Agent] 제목:', title);
  console.log('[Publisher Agent] 태그:', tags.join(', '));

  try {
    const naverService = getNaverBlogService();

    // 세션 파일 경로
    const sessionPath = `${process.cwd()}/naver-session.json`;

    // 저장된 세션 로드
    await naverService.loadSession(sessionPath);
    console.log('[Publisher Agent] 세션 로드 완료');

    // 이미지 경로 추출 (있는 경우)
    const imagePaths = images?.map(img => img.path || img.buffer ? img.path : null).filter(Boolean) as string[] || [];

    // 네이버 블로그에 발행
    const uploadResult = await naverService.uploadPost(
      { title, content, tags },
      naverBlogId,
      { imagePaths }
    );

    if (uploadResult.success) {
      console.log('[Publisher Agent] 발행 성공!');
      console.log('[Publisher Agent] 발행된 URL:', uploadResult.url);
      return {
        publishedUrl: uploadResult.url,
        error: undefined,
      };
    } else {
      console.error('[Publisher Agent] 발행 실패:', uploadResult.error);
      return {
        error: `발행 실패: ${uploadResult.error}`,
      };
    }
  } catch (error) {
    console.error('[Publisher Agent] 발행 오류:', error);
    return {
      error: `발행 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
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
