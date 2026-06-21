import type { BlogState } from '../state';
import { getGLMService } from '../../services/glm.service';

/**
 * Reviewer Agent Node
 * 생성된 글을 검토하여 자연스럽게 다듬고 AI 같은 느낌을 제거
 * 참고 블로그 내용과 비교하여 스타일을 더 잘 반영합니다.
 */
export async function reviewerNode(state: BlogState): Promise<Partial<BlogState>> {
  const { draft, styleProfile, referencePosts } = state;

  console.log('[Reviewer Agent] 시작');
  console.log('[Reviewer Agent] 초안 길이:', draft?.length);
  console.log('[Reviewer Agent] 참고 블로그 유무:', referencePosts ? '있음' : '없음');

  if (!draft) {
    return {
      error: '검토할 초안이 없습니다.',
    };
  }

  try {
    const glm = getGLMService();

    // 시스템 프롬프트
    const systemPrompt = `당신은 블로그 글 편집 전문가입니다.
생성된 블로그 글을 검토하여 사람이 쓴 것처럼 자연스럽게 다듬어주세요.

검토 항목:
1. 반복 표현 제거: 같은 내용을 여러 방식으로 반복하는 부분 정리
2. AI 느낌 감소: "매우", "정말", "아주" 등 과도한 수식어 조절
3. 문장 자연스러움: 어색한 문장 구조 수정
4. 문맥 보정: 앞뒤 문맥에 맞게 내용 연결
5. 참고 글 스타일 반영: 사용자의 기존 블로그 글 스타일을 최대한 비슷하게 따라하기

주의사항:
- 원래의 글쓰기 스타일은 유지하세요
- 핵심 내용은 변경하지 마세요
- 사용자의 말투(endingPattern)를 계속 따르세요
- 참고 블로그의 톤, 분위기, 표현 방식을 모방하세요`;

    // 참고 블로그가 있는 경우 프롬프트에 포함
    let userPrompt = `다음 블로그 글을 검토하고 수정해주세요:\n\n${draft}\n\n---\n\n검토 후 수정된 최종 글을 출력해주세요.`;

    if (referencePosts) {
      userPrompt = `다음 블로그 글을 검토하고 수정해주세요.

## 생성된 글 (검토 대상):
${draft}

---

## 참고 블로그 글 (스타일 모방용):
${referencePosts}

---

검토 가이드:
- 참고 블로그 글의 말투, 톤, 표현 방식을 모방하여 수정해주세요
- 참고 블로그에서 자주 사용하는 표현이나 패턴이 있다면 반영해주세요
- 하지만 내용은 생성된 글의 내용을 유지해주세요 (장소, 활동 등)

검토 후 수정된 최종 글을 출력해주세요.`;
    }

    console.log('[Reviewer Agent] 글 검토 요청...');
    const finalPost = await glm.generateText(systemPrompt, userPrompt);
    console.log('[Reviewer Agent] 글 검토 완료 (길이:', finalPost.length, '자)');

    return {
      finalPost,
    };
  } catch (error) {
    console.error('[Reviewer Agent] 글 검토 실패:', error);
    return {
      error: `글 검토 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}
