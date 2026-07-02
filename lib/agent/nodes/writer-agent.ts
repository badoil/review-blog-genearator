import type { BlogState } from '../state';
import type { PhotoGroupingResult } from '../../types/photo';
import { getGLMService } from '../../services/glm.service';
import type { RunnableConfig } from '@langchain/core/runnables';

/**
 * Writer Agent Node
 * 사진 분석 결과와 스타일 프로필을 바탕으로 블로그 글 생성
 * photoGrouping이 있으면 그룹별 텍스트 생성, 없으면 이미지별 섹션 생성
 */
export async function writerNode(
  state: BlogState,
  config?: RunnableConfig
): Promise<Partial<BlogState>> {
  const { photoAnalysis, styleProfile, images, photoGrouping } = state;

  console.log('[Writer Agent] 시작');
  console.log('[Writer Agent] 업로드된 이미지 개수:', images?.length || 0);
  console.log('[Writer Agent] 그룹핑 여부:', photoGrouping ? '있음' : '없음');
  // console.log('[Writer Agent] RunnableConfig', config?.callbacks?.handlers);
  // console.dir(config, { depth: 5 });

  // 그룹핑이 있으면 그룹별 텍스트 생성
  if (photoGrouping && photoGrouping.groups.length > 0) {
    console.log('[Writer Agent] 그룹별 텍스트 생성 모드');
    return writeFromGroups(photoGrouping, styleProfile, photoAnalysis, config);
  }

  // 기존 방식 (이미지별 섹션)
  console.log('[Writer Agent] 이미지별 섹션 생성 모드');
  return writeFromImages(photoAnalysis, styleProfile, images, config);
}

/**
 * 그룹별 텍스트 생성 (새로운 방식)
 */
async function writeFromGroups(
  photoGrouping: PhotoGroupingResult,
  styleProfile: any,
  photoAnalysis: any,
  config?: RunnableConfig
): Promise<Partial<BlogState>> {
  const groups = photoGrouping.groups;
  console.log('[Writer Agent] 그룹 개수:', groups.length);

  if (!styleProfile) {
    return { error: '스타일 프로필이 없습니다.' };
  }

  const glm = getGLMService();

  // 그룹별 섹션 길이 계산 (그룹에 속한 이미지들의 섹션 길이 평균)
  const groupSentenceCounts = groups.map((group) => {
    if (styleProfile.sectionTextLength && styleProfile.sectionTextLength.perSection) {
      // 그룹에 속한 이미지 인덱스들의 섹션 길이를 가져와서 평균 계산
      const indices = group.imageIndices;
      const sentenceCounts = indices.map((idx) => {
        // perSection은 0-based 인덱스, 이미지 index는 0-based
        return styleProfile.sectionTextLength.perSection[idx] || styleProfile.sectionTextLength.average || 2;
      });
      // 평균값 계산 (반올림)
      const avg = Math.round(sentenceCounts.reduce((a, b) => a + b, 0) / sentenceCounts.length);
      return Math.max(1, avg); // 최소 1문장
    }
    return 2; // 기본값 2문장
  });

  console.log('[Writer Agent] 그룹별 섹션 길이:', groupSentenceCounts.map((c, i) => `그룹${i + 1}: ${c}문장`).join(', '));

  // 그룹별 정보 준비
  const groupsInfo = groups.map((group, idx) => {
    const groupImages = (photoAnalysis?.images || []).filter((img: any) =>
      group.imageIndices.includes(img.index)
    );

    return {
      index: idx,
      id: group.id,
      title: group.title,
      description: group.description,
      mainItem: group.mainItem,
      category: group.category,
      imageCount: group.imageIndices.length,
      images: groupImages,
      sentenceCount: groupSentenceCounts[idx], // 섹션 길이 추가
    };
  });

  // 시스템 프롬프트
  const systemPrompt = `당신은 블로그 글 작성 전문가입니다.

**중요: 그룹 1개당 1개 섹션을 작성하세요**

작성 시 다음을 따르세요:
1. 각 그룹에 대해 자연스러운 텍스트를 작성하세요
2. **지정된 문장 수**만큼만 작성하세요
3. 절대로 지정된 문장 수를 초과하지 마세요
4. 스타일(말투, 문장 끝 패턴, 이모지)을 반영하세요
5. 제목과 태그를 작성하세요

**구조:**
- 제목
- 섹션 1: N문장 (지정된 문장 수만 작성)
- 섹션 2: N문장 (지정된 문장 수만 작성)
- ...
- 태그

**중요: 각 섹션은 반드시 "섹션 N:" 형식으로 시작해야 합니다.**
예: 섹션 1: 야외에서 즐기는 따끈한 타코야끄는...

스타일 반영:
- 글의 전체적인 말투를 사용자 스타일(tone)에 맞추세요
- 문장 끝 패턴(endingPattern)을 따르세요
- 이모지 사용 정도(emojiLevel)를 맞추세요
- 문단 길이(paragraphLength)를 고려하세요
- 사용자의 특징적인 글쓰기 스타일(writingStyle)을 반영하세요`;

  // 사용자 프롬프트
  const userPrompt = `다음 정보를 바탕으로 블로그 글을 작성해주세요:

## 전체 정보
${photoAnalysis ? `
- 활동: ${(photoAnalysis.activities || []).join(', ') || '없음'}
- 음식: ${(photoAnalysis.foods || []).join(', ') || '없음'}
- 분위기: ${photoAnalysis.mood || '없음'}
` : ''}

## 그룹별 정보 (${groups.length}개 그룹)
${groupsInfo.map((g, idx) => `
**그룹 ${idx + 1}: ${g.title}** (${g.imageCount}장, ${g.sentenceCount}문장)
- 메인 아이템: ${g.mainItem}
- 카테고리: ${g.category}
- 설명: ${g.description}
${g.images.length > 0 ? g.images.map((img: any, i: number) => `  - 이미지 ${i + 1}: ${img.description || ''}`).join('\n') : ''}
`).join('\n')}

## 글쓰기 스타일
- 말투: ${styleProfile.tone || '친근함'}
- 문장 끝 패턴: ${styleProfile.endingPattern || '~해요'}
- 이모지 사용: ${styleProfile.emojiLevel ?? 1}/3
- 문단 길이: ${styleProfile.paragraphLength || 'medium'}
- 글쓰기 특징: ${styleProfile.writingStyle || '정보 전달 중심'}
${styleProfile.commonPhrases && styleProfile.commonPhrases.length > 0 ? `- 자주 사용하는 표현: ${styleProfile.commonPhrases.join(', ')}` : ''}

---

## 섹션별 텍스트 길이 (반드시 따라야 할 길이)
${groupsInfo.map((g, idx) => `- 섹션 ${idx + 1} (그룹 ${idx + 1}): **${g.sentenceCount}문장** (반드시 ${g.sentenceCount}문장만 작성)`).join('\n')}

**절대 위 길이를 초과하지 마세요! 예: 섹션 1이 2문장이면 정확히 2문장만 작성하세요.**

---

**작성 제약 조건 요약:**
- 총 ${groups.length}개 섹션 작성
- 각 섹션 문장 수: ${groupsInfo.map((g) => g.sentenceCount).join(', ')}문장
- 절대 문장 수를 초과하지 마세요!

다음 형식으로 작성해주세요:

---
# [제목]

섹션 1: ${groups[0]?.title || '첫 번째'}에 대한 내용

섹션 2: ${groups[1]?.title || '두 번째'}에 대한 내용

...

---
태그: #태그1 #태그2 #태그3 ...

**중요: 각 섹션은 반드시 "섹션 N:" 형식으로 시작해야 합니다.**`;

  try {
    console.log('[Writer Agent] 그룹별 글 생성 요청...');
    const draft = await glm.generateText(systemPrompt, userPrompt, config);
    console.log('[Writer Agent] 글 생성 완료 (길이:', draft.length, '자)');

    // 그룹별 이미지 배치 정보 생성
    const imagePlacements = groups.map((group, idx) => {
      // 그룹의 첫 번째 이미지 인덱스를 배치 기준으로 사용
      const firstImageIndex = group.imageIndices[0];
      return {
        imageIndex: firstImageIndex,
        position: 'before' as const,
        sectionTitle: `그룹 ${idx + 1}`,
        groupImageIndices: group.imageIndices,  // 그룹에 속한 모든 이미지 인덱스
      };
    });

    console.log('[Writer Agent] 그룹별 이미지 배치 정보:', imagePlacements);

    return { draft, imagePlacements };
  } catch (error) {
    console.error('[Writer Agent] 글 생성 실패:', error);
    return {
      error: `글 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}

/**
 * 이미지별 섹션 생성 (기존 방식)
 */
async function writeFromImages(
  photoAnalysis: any,
  styleProfile: any,
  images: any,
  config?: RunnableConfig
): Promise<Partial<BlogState>> {

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
${safeTimeline(photoAnalysis.timeline)}

**중요: 장소나 위치를 추측하지 마세요. 음식만으로 장소를 단정하지 마세요.**

${photoAnalysis.images && photoAnalysis.images.length > 0 ? `
## 각 이미지별 분석 결과
${photoAnalysis.images.map((img: any, i: number) => `
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
${images.map((_: any, i: number) => {
  const sentenceCount = styleProfile.sectionTextLength!.perSection[i] || Math.round(styleProfile.sectionTextLength!.average);
  return `- 섹션 ${i + 1} (이미지 ${i + 1}): **${sentenceCount}문장** (반드시 ${sentenceCount}문장만 작성)`;
}).join('\n')}

**절대 위 길이를 초과하지 마세요! 예: 섹션 1이 1문장이면 정확히 1문장만 작성하세요.**
` : ''}

---

**작성 제약 조건 요약:**
${images && images.length > 0 ? `- 총 ${images.length}개 섹션 작성` : ''}
${styleProfile.sectionTextLength && images && images.length > 0 ? `- 각 섹션 문장 수: ${images.map((_: any, i: number) => styleProfile.sectionTextLength!.perSection[i] || Math.round(styleProfile.sectionTextLength!.average)).join(', ')}문장` : ''}
- 절대 문장 수를 초과하지 마세요!

${images && images.length > 0 ? `
## 이미지 배치 가이드
업로드된 이미지가 ${images.length}장 있습니다. 위의 "각 이미지별 분석 결과"를 참고하여 글을 작성할 때 이미지를 적절한 위치에 배치해주세요.

이미지 배치 방법:
- 각 이미지를 해당 섹션 **앞**에 배치 (이미지 먼저, 텍스트 나중)
- 섹션은 "섹션 1", "섹션 2" ... 형식으로 번호로 표기
- position은 항상 "before" 사용 (이미지가 섹션 텍스트 앞에 옴)

배치 위치를 JSON 형식으로 표시해주세요:
\`\`\`json
[
  {"imageIndex": 0, "position": "before", "sectionTitle": "섹션 1"},
  {"imageIndex": 1, "position": "before", "sectionTitle": "섹션 2"},
  ...
]
\`\`\`

**중요: sectionTitle은 반드시 "섹션 N" 형식이어야 합니다. (예: "섹션 1", "섹션 2")**
**중요: position은 항상 "before"를 사용하세요 (이미지 먼저, 텍스트 나중)**
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
      images.forEach((_: any, i: number) => {
        const target = styleProfile.sectionTextLength!.perSection[i] || Math.round(styleProfile.sectionTextLength!.average);
        console.log(`  - 섹션 ${i + 1}: ${target}문장 (목표)`);
      });
    }

    const draft = await glm.generateText(systemPrompt, userPrompt, config);
    console.log('[Writer Agent] 글 생성 완료 (길이:', draft.length, '자)');

    // 생성된 글의 문장 수 계산
    const totalSentences = draft.split(/[.!?]/).filter(s => s.trim().length > 0).length;
    console.log('[Writer Agent] 생성된 글의 전체 문장 수:', totalSentences);

    // 섹션별 문장 수 계산 (목표와 비교)
    if (images && images.length > 0 && styleProfile.sectionTextLength) {
      console.log('[Writer Agent] 섹션별 문장 수 비교:');
      images.forEach((_: any, i: number) => {
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

          // 필드명 검증 및 변환 (section → sectionTitle)
          if (Array.isArray(imagePlacements)) {
            imagePlacements = imagePlacements.map((item: any) => {
              // section 필드가 있으면 sectionTitle로 변환
              if (item.section && !item.sectionTitle) {
                return { ...item, sectionTitle: item.section, section: undefined };
              }
              // after를 before로 강제 변환 (이미지 먼저 나오도록)
              if (item.position === 'after') {
                console.warn('[Writer Agent] after 감지, before로 변환:', item);
                return { ...item, position: 'before' };
              }
              return item;
            });
          }

          console.log('[Writer Agent] 이미지 배치 정보 추출 성공:', JSON.stringify(imagePlacements, null, 2));

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
