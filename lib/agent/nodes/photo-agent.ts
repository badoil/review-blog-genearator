import type { BlogState } from '../state';
import type { PhotoAnalysis } from '../../types/photo';
import { getGeminiService } from '../../services/gemini.service';
import { getPhotoCacheService } from '../../services/cache.service';

/**
 * Photo Agent Node
 * 업로드된 이미지를 분석하여 장소, 활동, 음식, 분위기, 타임라인을 추출
 * Gemini 2.5 Flash를 사용하여 이미지 분석을 수행합니다.
 */
export async function photoNode(state: BlogState): Promise<Partial<BlogState>> {
  const { images } = state;

  console.log('[Photo Agent] 시작, 이미지 개수:', images?.length);

  if (!images || images.length === 0) {
    return {
      error: '이미지가 없습니다.',
    };
  }

  try {
    const photoCache = getPhotoCacheService();

    // 이미지 파일 경로/파일명 기반 캐시 키 생성
    const imageKeys = images.map(img => `${img.path || ''}:${img.filename || ''}`).join('|');
    const cacheKey = imageKeys;
    console.log('[Photo Agent] 캐시 키 (파일 기반):', imageKeys.substring(0, 50) + '...');

    // 캐시 확인
    const cached = await photoCache.get(cacheKey);
    if (cached) {
      console.log('[Photo Agent] 캐시된 결과 사용');
      return {
        photoAnalysis: cached,
      };
    }

    console.log('[Photo Agent] 캐시 미스, Gemini 이미지 분석 시작...');
    const gemini = getGeminiService();

    // Gemini로 이미지 분석
    const photoAnalysis = await gemini.analyzeImages(images);
    console.log('[Photo Agent] 이미지 분석 완료:', photoAnalysis);

    // 캐시 저장
    await photoCache.set(cacheKey, photoAnalysis);

    return {
      photoAnalysis,
    };
  } catch (error) {
    console.error('[Photo Agent] 이미지 분석 실패:', error);
    return {
      error: `사진 분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}
