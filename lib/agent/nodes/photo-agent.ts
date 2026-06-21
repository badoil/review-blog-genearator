import type { BlogState } from '../state';
import type { PhotoAnalysis } from '../../types/photo';
import { getGeminiService } from '../../services/gemini.service';

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
    const gemini = getGeminiService();

    console.log('[Photo Agent] Gemini 이미지 분석 시작...');
    // Gemini로 이미지 분석
    const photoAnalysis = await gemini.analyzeImages(images);
    console.log('[Photo Agent] 이미지 분석 완료:', photoAnalysis);

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
