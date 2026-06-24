import type { BlogState } from '../state';
import { getGLMService } from '../../services/glm.service';

/**
 * Writer Agent Node
 * 사진 분석 결과와 스타일 프로필을 바탕으로 블로그 글 생성
 */
export async function writerNode(state: BlogState): Promise<Partial<BlogState>> {
  const { photoAnalysis, styleProfile, images } = state;

  console.log('[Writer Agent] 시작');
  console.log('[Writer Agent] 사진 분석 결과:', photoAnalysis);
  console.log('[Writer Agent] 스타일 프로필:', styleProfile);
  console.log('[Writer Agent] 업로드된 이미지 개수:', images?.length || 0);

  if (!photoAnalysis) {
    return {
      error: '사진 분석 결과가 없습니다.',
    };
  }

  if (!styleProfile) {
    return {
      error: '스타일 프로필이 없습니다.',
    };
  }

  // 필수 필드 검증
  if (!photoAnalysis.places || photoAnalysis.places.length === 0) {
    return {
      error: '사진 분석 결과에 장소 정보가 없습니다.',
    };
  }

  // 안전한 접근을 위한 헬퍼
  const safeJoin = (arr?: string[], defaultValue: string = '없음') => {
    return (arr && arr.length > 0) ? arr.join(', ') : defaultValue;
  };

  const safeTimeline = (timeline?: any[]) => {
    if (!timeline || timeline.length === 0) return '';
    const items = timeline.map(t => `${t.time || ''} ${t.location || ''} ${t.activity || ''}`.trim()).join(' → ');
    return `- 동선: ${items}`;
  };

  try {
    const glm = getGLMService();

    // 시스템 프롬프트
    const systemPrompt = `당신은 블로그 글 작성 전문가입니다.

**중요: 이미지 1개당 1개 섹션을 작성하세요**

작성 시 다음을 따르세요:
1. 각 이미지에 대해 **지정된 문장 수**만큼만 작성하세요
2. 절대로 지정된 문장 수를 초과하지 마세요
3. 스타일(말투, 문장 끝 패턴, 이모지)을 반영하세요
4. 제목과 태그를 작성하세요

**구조:**
- 제목
- 섹션 1 (이미지 1): N문장
- 섹션 2 (이미지 2): N문장
- ...
- 태그

스타일 반영:
- 글의 전체적인 말투를 사용자 스타일(tone)에 맞추세요
- 문장 끝 패턴(endingPattern)을 따르세요
- 이모지 사용 정도(emojiLevel)를 맞추세요
- 문단 길이(paragraphLength)를 고려하세요
- 사용자의 특징적인 글쓰기 스타일(writingStyle)을 반영하세요`;

    // 사용자 프롬프트
    const userPrompt = `다음 정보를 바탕으로 블로그 글을 작성해주세요:

## 사진 분석 결과 (새 글의 내용)
- 활동: ${safeJoin(photoAnalysis.activities)}
- 음식: ${safeJoin(photoAnalysis.foods)}
- 분위기: ${photoAnalysis.mood || '정보 없음'}
${safeTimeline(photoAnalysis.timeline)}

**중요: 장소나 위치를 추측하지 마세요. 음식만으로 장소를 단정하지 마세요.**

${photoAnalysis.images && photoAnalysis.images.length > 0 ? `
## 각 이미지별 분석 결과
${photoAnalysis.images.map((img, i) => `
**이미지 #${i}** (${img.description})
- 활동: ${img.activities?.join(', ') || '없음'}
- 음식: ${img.foods?.join(', ') || '없음'}
- 시간대: ${img.time || '추정 불가'}
`).join('')}
` : ''}

## 글쓰기 스타일
- 말투: ${styleProfile.tone || '친근함'}
- 문장 끝 패턴: ${styleProfile.endingPattern || '~해요'}
- 이모지 사용: ${styleProfile.emojiLevel ?? 1}/3
- 문단 길이: ${styleProfile.paragraphLength || 'medium'}
- 글쓰기 특징: ${styleProfile.writingStyle || '정보 전달 중심'}
${styleProfile.commonPhrases && styleProfile.commonPhrases.length > 0 ? `- 자주 사용하는 표현: ${styleProfile.commonPhrases.join(', ')}` : ''}
${styleProfile.sentenceStyle ? `- 문장 스타일: ${styleProfile.sentenceStyle}` : ''}
${styleProfile.punctuation ? `- 문장 부호: ${styleProfile.punctuation}` : ''}

${styleProfile.sectionTextLength && images && images.length > 0 ? `
## 섹션별 텍스트 길이 (반드시 따라야 할 길이)
${images.map((_, i) => {
  const sentenceCount = styleProfile.sectionTextLength!.perSection[i] || Math.round(styleProfile.sectionTextLength!.average);
  return `- 섹션 ${i + 1} (이미지 ${i + 1}): **${sentenceCount}문장** (반드시 ${sentenceCount}문장만 작성)`;
}).join('\n')}

**절대 위 길이를 초과하지 마세요! 예: 섹션 1이 1문장이면 정확히 1문장만 작성하세요.**
` : ''}

---

**작성 제약 조건 요약:**
${images && images.length > 0 ? `- 총 ${images.length}개 섹션 작성` : ''}
${styleProfile.sectionTextLength && images && images.length > 0 ? `- 각 섹션 문장 수: ${images.map((_, i) => styleProfile.sectionTextLength!.perSection[i] || Math.round(styleProfile.sectionTextLength!.average)).join(', ')}문장` : ''}
- 절대 문장 수를 초과하지 마세요!

${images && images.length > 0 ? `
## 이미지 배치 가이드
업로드된 이미지가 ${images.length}장 있습니다. 위의 "각 이미지별 분석 결과"를 참고하여 글을 작성할 때 이미지를 적절한 위치에 배치해주세요.

이미지 배치 방법:
- 각 이미지의 내용(장소, 음식, 활동)을 고려하여 관련 문단 근처에 배치
- 예: 카페 이미지는 카페 소개 문단 후, 음식 이미지는 음식 설명 후
- ${images.length}장의 이미지를 글 전체에 고르게 분배

배치 위치를 JSON 형식으로 표시해주세요:
\`\`\`json
[
  {"imageIndex": 0, "position": "after", "section": "도입부"},
  {"imageIndex": 1, "position": "after", "section": "음식 설명"},
  ...
]
\`\`\`
` : ''}

다음 형식으로 작성해주세요:

---
# [제목]

[섹션 1: 이미지 1에 대한 내용 - N문장]

[섹션 2: 이미지 2에 대한 내용 - N문장]

...

---
태그: #태그1 #태그2 #태그3 ...

${images && images.length > 0 ? `
---
## 이미지 배치 정보 (JSON)
위 가이드에 따라 이미지 배치 정보를 JSON 형식으로 작성해주세요.
이 JSON은 글 뒤에 별도로 작성해주세요.
` : ''}`;

    console.log('[Writer Agent] 글 생성 요청...');

    // 섹션별 문장 수 제약 로그
    if (images && images.length > 0 && styleProfile.sectionTextLength) {
      console.log('[Writer Agent] 섹션별 문장 수 제약:');
      images.forEach((_, i) => {
        const target = styleProfile.sectionTextLength!.perSection[i] || Math.round(styleProfile.sectionTextLength!.average);
        console.log(`  - 섹션 ${i + 1}: ${target}문장 (목표)`);
      });
    }

    const draft = await glm.generateText(systemPrompt, userPrompt);
    console.log('[Writer Agent] 글 생성 완료 (길이:', draft.length, '자)');

    // 생성된 글의 문장 수 계산
    const totalSentences = draft.split(/[.!?]/).filter(s => s.trim().length > 0).length;
    console.log('[Writer Agent] 생성된 글의 전체 문장 수:', totalSentences);

    // 섹션별 문장 수 계산 (목표와 비교)
    if (images && images.length > 0 && styleProfile.sectionTextLength) {
      console.log('[Writer Agent] 섹션별 문장 수 비교:');
      images.forEach((_, i) => {
        const target = styleProfile.sectionTextLength!.perSection[i] || Math.round(styleProfile.sectionTextLength!.average);
        // 섹션 찾기 (예: [섹션 1: ...])
        const sectionRegex = new RegExp(`\\[섹션 ${i + 1}:([^\\[]*(?:\\[[^\\]]*\\][^\\[]*)*)\\]`, 's');
        const sectionMatch = draft.match(sectionRegex);
        let actualSentences = 0;
        if (sectionMatch) {
          const sectionText = sectionMatch[1];
          actualSentences = sectionText.split(/[.!?]/).filter(s => s.trim().length > 0).length;
        }
        const status = actualSentences === target ? '✓' : '✗ (초과)';
        console.log(`  - 섹션 ${i + 1}: ${actualSentences}문장 / ${target}문장 (목표) ${status}`);
      });
    }

    // 이미지 배치 정보 추출 (이미지가 있는 경우)
    let imagePlacements: any[] | undefined;
    let cleanDraft = draft;

    if (images && images.length > 0) {
      // JSON 부분 추출 시도
      const jsonMatch = draft.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          imagePlacements = JSON.parse(jsonMatch[1]);
          console.log('[Writer Agent] 이미지 배치 정보 추출 성공:', imagePlacements);

          // JSON 부분을 제거한 clean 글 생성
          cleanDraft = draft.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
          console.log('[Writer Agent] clean 글 길이:', cleanDraft.length);
        } catch (e) {
          console.warn('[Writer Agent] 이미지 배치 JSON 파싱 실패:', e);
        }
      }
    }

    return {
      draft: cleanDraft,
      imagePlacements,
    };
  } catch (error) {
    console.error('[Writer Agent] 글 생성 실패:', error);
    return {
      error: `글 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}
