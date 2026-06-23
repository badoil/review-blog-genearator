import type { BlogState } from '../state';
import { getGLMService } from '../../services/glm.service';

/**
 * Writer Agent Node
 * 사진 분석 결과와 스타일 프로필을 바탕으로 블로그 글 생성
 */
export async function writerNode(state: BlogState): Promise<Partial<BlogState>> {
  const { photoAnalysis, styleProfile, referencePosts, images } = state;

  console.log('[Writer Agent] 시작');
  console.log('[Writer Agent] 사진 분석 결과:', photoAnalysis);
  console.log('[Writer Agent] 스타일 프로필:', styleProfile);
  console.log('[Writer Agent] 참고 블로그 유무:', referencePosts ? '있음' : '없음');
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

**중요: 참고 블로그를 완전히 모방하세요**

작성 시 다음을 따르세요:
1. 참고 블로그의 **전체 구조**를 그대로 따르세요
2. 참고 블로그의 **섹션 순서**를 지키세요
3. 참고 블로그의 **문장 길이**와 **문단 길이**를 복제하세요
4. 참고 블로그의 **헤더 사용** 패턴을 따르세요
5. 참고 블로그의 **글 전체 길이**와 비슷하게 작성하세요 (너무 길지 않게!)

작성 가이드:
1. 제목: 흥미롭고 클릭을 유도하는 제목
2. 도입부: 독자의 관심을 끄는 도입段落
3. 본문: 장소/활동/음식에 대한 상세한 설명
4. 마무리: 여행/식사에 대한 감상과 추천
5. 태그: 검색에 적합한 태그 5-10개

스타일 반영:
- 글의 전체적인 말투를 사용자 스타일(tone)에 맞추세요
- 문장 끝 패턴(endingPattern)을 따르세요
- 이모지 사용 정도(emojiLevel)를 맞추세요
- 문단 길이(paragraphLength)를 고려하세요
- 사용자의 특징적인 글쓰기 스타일(writingStyle)을 반영하세요`;

    // 사용자 프롬프트
    const userPrompt = `다음 정보를 바탕으로 블로그 글을 작성해주세요:

${referencePosts ? `
## 참고 블로그 전체 (구조, 길이, 문체를 그대로 모방하세요)
${referencePosts}

---

**중요: 위 참고 블로그를 완전히 모방하세요**
- 참고 블로그의 전체 구조를 그대로 따르세요 (섹션 순서, 개수, 유형)
- 글 전체 길이를 참고 블로그와 비슷하게 맞추세요 (너무 길지 않게!)
- 문장 길이와 문단 길이를 복제하세요
- 헤더 사용 패턴을 따르세요

---

` : ''}## 사진 분석 결과 (새 글의 내용)
- 장소: ${safeJoin(photoAnalysis.places)}
- 활동: ${safeJoin(photoAnalysis.activities)}
- 음식: ${safeJoin(photoAnalysis.foods)}
- 분위기: ${photoAnalysis.mood || '정보 없음'}
${safeTimeline(photoAnalysis.timeline)}

${photoAnalysis.images && photoAnalysis.images.length > 0 ? `
## 각 이미지별 분석 결과
${photoAnalysis.images.map((img, i) => `
**이미지 #${i}** (${img.description})
- 장소: ${img.places?.join(', ') || '없음'}
- 활동: ${img.activities?.join(', ') || '없음'}
- 음식: ${img.foods?.join(', ') || '없음'}
- 시간대: ${img.time || '추정 불가'}
- 장소명: ${img.location || '없음'}
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

${referencePosts ? `
## 작성 지시
1. 위 **참고 블로그의 구조를 그대로 따르세요**
   - 섹션 개수, 섹션 순서, 섹션 유형을 동일하게
   - 헤더가 있으면 헤더 사용, 없으면 없이
   - 도입부-본문-마무리 구조를 복제

2. **글 전체 길이를 참고 블로그와 비슷하게 맞추세요**
   - 참고 블로그가 전체 몇 문장인지 세어보고 비슷하게
   - 각 섹션의 문장 수도 참고 블로그와 비슷하게
   - 너무 길게 쓰지 마세요!

3. **문장 길이와 문단 길이를 복제하세요**
   - 참고 블로그의 평균 문장 길이를 보고 따르세요
   - 문단이 길면 길게, 짧으면 짧게

4. **사진 분석 결과를 참고 블로그 구조에 맞춰 넣으세요**
   - 내용만 새로운 사진 정보로, 구조/형식은 참고 블로그 그대로
` : ''}

${styleProfile.sectionTextLength ? `
## 섹션별 텍스트 길이 (따라야 할 길이)
- 평균: ${styleProfile.sectionTextLength.average}문장/섹션
- 범위: ${styleProfile.sectionTextLength.min}-${styleProfile.sectionTextLength.max}문장
- 각 섹션: ${styleProfile.sectionTextLength.perSection.join(', ')}문장

**중요: 각 섹션을 위 길이만큼만 작성하세요. 너무 길지 않게!**
` : ''}

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

[도입부]

## [본문 제목]

[본문 내용]

## [마무리]

[마무리 내용]

---
태그: #태그1 #태그2 #태그3 ...

${images && images.length > 0 ? `
---
## 이미지 배치 정보 (JSON)
위 가이드에 따라 이미지 배치 정보를 JSON 형식으로 작성해주세요.
이 JSON은 글 뒤에 별도로 작성해주세요.
` : ''}`;

    console.log('[Writer Agent] 글 생성 요청...');
    const draft = await glm.generateText(systemPrompt, userPrompt);
    console.log('[Writer Agent] 글 생성 완료 (길이:', draft.length, '자)');

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
