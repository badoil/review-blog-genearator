import type { BlogState } from '../state';
import type { StyleProfile } from '../../types/style';
import { getGLMService } from '../../services/glm.service';
import { getStyleCacheService } from '../../services/cache.service';
import type { RunnableConfig } from '@langchain/core/runnables';

/**
 * Style Agent Node
 * 기존 블로그 글들을 분석하여 사용자의 글쓰기 스타일을 추출
 */
export async function styleNode(
  state: BlogState,
  config?: RunnableConfig
): Promise<Partial<BlogState>> {
  const { blogUrls } = state;

  console.log('[Style Agent] 시작, URL 개수:', blogUrls?.length);

  if (!blogUrls || blogUrls.length === 0) {
    return {
      error: '블로그 URL이 없습니다.',
    };
  }

  try {
    const styleCache = getStyleCacheService();

    // 블로그 URL 기반 캐시 키 생성 (정렬하여 일관성 유지)
    const sortedUrls = [...blogUrls].sort();
    const cacheKey = sortedUrls.join(',');

    // 캐시 확인
    const cached = await styleCache.get(cacheKey);
    if (cached) {
      console.log('[Style Agent] 캐시된 결과 사용');
      return {
        styleProfile: cached,
        referencePosts: cached.referencePosts || '', // 필요시 참고 블로그 내용도 포함
      };
    }

    console.log('[Style Agent] 캐시 미스, 스타일 분석 시작...');
    const glm = getGLMService();

    // 블로그 글 가져오기 (크롤러 서비스)
    console.log('[Style Agent] 블로그 크롤링 시작...');
    const { crawlerService } = await import('../../services/crawler.service');
    const blogPosts = await crawlerService.fetchMultiplePosts(blogUrls);
    console.log('[Style Agent] 크롤링 완료, 글 개수:', blogPosts.length);
    blogPosts.forEach((post, i) => {
      console.log(`[Style Agent] 글 ${i + 1}: "${post.title}" (${post.content.length}자)`);
      console.log(`[Style Agent] 섹션 개수:`, post.sectionTexts?.length || 0);
    });

    // 블로그 글들을 하나의 텍스트로 합치기
    const blogTexts = blogPosts.map((post, i) => {
      let text = `=== 글 ${i + 1} ===
제목: ${post.title}
본문:
${post.content}
`;

      // 섹션 텍스트 정보 추가
      if (post.sectionTexts && post.sectionTexts.length > 0) {
        text += `\n섹션별 텍스트:\n`;
        post.sectionTexts.forEach((section, idx) => {
          const sentenceCount = section.text ? section.text.split(/[.!?]/).filter(s => s.trim().length > 0).length : 0;
          text += `- 섹션${idx + 1}: ${sentenceCount}문장 (${section.text?.substring(0, 50)}...)\n`;
        });
        console.log(`[Style Agent] 섹션별 텍스트 내용:`);
        post.sectionTexts.forEach((section, idx) => {
          console.log(`  섹션${idx + 1}: ${section.text.substring(0, 100)}...`);
        });
      }

      return text;
    }).join('\n');

    // 시스템 프롬프트 (개선됨)
    const systemPrompt = `당신은 블로그 글쓰기 스타일 분석 전문가입니다.
제공된 블로그 글들을 **실제 내용을 기반으로 통계적으로 분석**하여 작성자의 글쓰기 스타일을 JSON 형식으로 추출해주세요.

중요: 실제 글에 나타나는 패턴만 분석하세요. 글에 없는 내용을 추측하지 마세요.

{
  "tone": "전체적인 말투 (예: 친근함, 정중함, 활기참, 차분함, 감성적 등)",
  "endingPattern": "자주 사용하는 문장 끝 패턴 (예: ~했어요, ~합니다, ~인 것 같아요, ~네요 등)",
  "emojiLevel": 0-3 (0: 사용안함, 1: 적게, 2: 보통, 3: 많이),
  "paragraphLength": "short|medium|long (문단 평균 길이)",
  "writingStyle": "특징적인 글쓰기 스타일 설명 (예: 짧은 문장 위주, 감성적인 표현, 정보 전달 중심 등)",
  "commonPhrases": ["자주 사용하는 표현1", "표현2", "표현3"],
  "sentenceStyle": "문장 스타일 (예: 단문 위주, 긴 문장 혼용 등)",
  "punctuation": "문장 부호 사용 습관 (실제 사용 빈도 기반)",
  "sectionTextLength": {
    "perSection": [섹션1별 문장수, 섹션2별 문장수, ...],
    "average": 평균 문장 수,
    "min": 최소 문장 수,
    "max": 최대 문장 수
  }
}

분석 가이드:
- tone: 글의 전체적인 분위기와 말투
- endingPattern: 문장을 끝맺는 패턴을 실제로 확인하여 가장 많은 패턴 선택
- emojiLevel: 실제 이모지 개수를 세어서 결정 (0개=0, 1-2개=1, 3-5개=2, 6개이상=3)
- paragraphLength: 문단의 평균 길이를 실제로 측정하여 short(30자미만)/medium(30-80자)/long(80자이상)으로 분류
- writingStyle: 구체적인 글쓰기 특징을 실제 내용에서 발견된 것만 작성
- commonPhrases: 반복해서 사용하는 표현을 실제로 찾아서 3-5개 추출 (없으면 빈 배열)
- sentenceStyle: 문장이 긴지 짧은지 실제로 측정
- punctuation: 느낌표(!), 줄임표(...), 물음표(?) 등의 실제 사용 횟수를 세어서 기술 (없으면 "사용하지 않음"이라고 작성)
- sectionTextLength: **중요** "섹션별 텍스트" 섹션을 확인하여 각 섹션의 문장 수를 실제로 세어서 기록하세요.
  - 예시: 섹션별 텍스트에 "섹션1: 3문장"이라고 되어 있으면 perSection 배열에 [3]을 넣으세요.
  - 섹션이 없으면 sectionTextLength 필드를 완전히 제외하세요 (null 또는 undefined).`;

    const userPrompt = `다음 블로그 글들의 글쓰기 스타일을 **실제 내용을 기반으로 통계적으로 분석**해주세요:

${blogTexts}

분석 시 주의사항:
1. 실제 글에 나타나는 내용만 분석하세요
2. 문장 부호 사용은 실제 개수를 세어서 정확하게 작성하세요
3. 이모지 사용도 실제 개수를 확인하세요
4. **섹션별 텍스트 길이** - 위 "섹션별 텍스트" 섹션에 있는 내용을 그대로 사용하세요. 없으면 sectionTextLength 필드를 포함하지 마세요.
5. 글에 없는 패턴은 "사용하지 않음" 또는 빈 배열로 표시하세요

**중요: sectionTextLength는 위 "섹션별 텍스트" 섹션에 있는 내용만 사용하세요. 섹션이 전혀 없으면 이 필드를 아예 만들지 마세요.**`;

    console.log('[Style Agent] 스타일 분석 요청...');
    const response = await glm.generateJSON<StyleProfile & {
      commonPhrases?: string[];
      sentenceStyle?: string;
      punctuation?: string;
      sectionTextLength?: {
        perSection: number[];
        average: number;
        min: number;
        max: number;
      };
    }>(systemPrompt, userPrompt, config);

    console.log('[Style Agent] 스타일 분석 완료:');
    console.log('[Style Agent] - 말투(tone):', response.tone);
    console.log('[Style Agent] - 문장 끝 패턴(endingPattern):', response.endingPattern);
    console.log('[Style Agent] - 이모지 사용(emojiLevel):', response.emojiLevel, '/3');
    console.log('[Style Agent] - 문단 길이(paragraphLength):', response.paragraphLength);
    console.log('[Style Agent] - 글쓰기 특징(writingStyle):', response.writingStyle);
    if (response.commonPhrases) {
      console.log('[Style Agent] - 자주 사용하는 표현(commonPhrases):', response.commonPhrases);
    }
    if (response.sentenceStyle) {
      console.log('[Style Agent] - 문장 스타일(sentenceStyle):', response.sentenceStyle);
    }
    if (response.punctuation) {
      console.log('[Style Agent] - 문장 부호(punctuation):', response.punctuation);
    }
    if (response.sectionTextLength) {
      console.log('[Style Agent] - 섹션별 텍스트 길이(sectionTextLength):', response.sectionTextLength);
    }

    const styleResult = {
      styleProfile: response as StyleProfile,
      referencePosts: blogTexts, // 참고 블로그 내용 저장 (리뷰어에서 비교용)
    };

    // 캐시 저장
    await styleCache.set(cacheKey, styleResult.styleProfile);

    return styleResult;
  } catch (error) {
    console.error('[Style Agent] 스타일 분석 실패:', error);
    return {
      error: `스타일 분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}
