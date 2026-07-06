import type { BlogState } from '../state';
import type { PhotoAnalysis } from '../../types/photo';
import { getGeminiService } from '../../services/gemini.service';
import { getPhotoCacheService } from '../../services/cache.service';
import { sortImagesByCategory, getImageCategory, getCategoryName } from '../../utils/category-mapper';
import type { RunnableConfig } from '@langchain/core/runnables';

/**
 * Photo Agent Node
 * 업로드된 이미지를 분석하여 장소, 활동, 음식, 분위기, 타임라인을 추출
 * Gemini 2.5 Flash를 사용하여 이미지 분석을 수행합니다.
 *
 * 캐시 전략: 이미지별 개별 캐싱 (이미지 추가/제거 시에도 기존 이미지는 캐시 히트)
 */
export async function photoNode(
  state: BlogState,
  config?: RunnableConfig
): Promise<Partial<BlogState>> {
  const { images } = state;

  console.log('[Photo Agent] 시작, 이미지 개수:', images?.length);

  if (!images || images.length === 0) {
    return {
      error: '이미지가 없습니다.',
    };
  }

  try {
    const photoCache = getPhotoCacheService();

    // 이미지별 개별 캐시 키 생성
    const imageKeys = images.map((img, idx) => ({
      idx,
      key: `${img.path || ''}:${img.filename || ''}`,
      image: img,
    }));

    console.log('[Photo Agent] 개별 캐시 조회 시작...');

    // 개별 캐시 조회 (병렬)
    const cacheResults = await Promise.all(
      imageKeys.map(async ({ key }) => {
        const cached = await photoCache.get(key);
        return { key, cached };
      })
    );

    // 캐시된 것과 안 된 것 분리
    const cachedImages: Array<{ idx: number; data: any }> = [];
    const uncachedImages: Array<{ idx: number; key: string; image: any }> = [];

    cacheResults.forEach(({ key, cached }, i) => {
      if (cached) {
        console.log(`[Photo Agent] 이미지 ${i + 1} 캐시 히트:`, key.substring(0, 30) + '...');
        cachedImages.push({ idx: i, data: cached });
      } else {
        console.log(`[Photo Agent] 이미지 ${i + 1} 캐시 미스:`, key.substring(0, 30) + '...');
        uncachedImages.push({ idx: i, key, image: imageKeys[i].image });
      }
    });

    console.log(`[Photo Agent] 캐시 히트: ${cachedImages.length}/${images.length}, 캐시 미스: ${uncachedImages.length}`);

    // 캐시 미스인 이미지들만 Gemini 분석
    let newAnalysis: any = null;
    if (uncachedImages.length > 0) {
      console.log('[Photo Agent] 캐시 미스한 이미지 Gemini 분석 시작...');
      const gemini = getGeminiService();

      // 원본 순서대로 정렬하여 분석
      const imagesToAnalyze = uncachedImages
        .sort((a, b) => a.idx - b.idx)
        .map(item => item.image);

      newAnalysis = await gemini.analyzeImages(imagesToAnalyze);

      console.log('[Photo Agent] Gemini 분석 완료');

      // 개별 캐시 저장
      await Promise.all(
        uncachedImages.map((item, i) => {
          // newAnalysis.images는 정렬된 순서대로 있음
          const imageIndex = uncachedImages
            .sort((a, b) => a.idx - b.idx)
            .findIndex(u => u.idx === item.idx);

          if (imageIndex !== -1 && newAnalysis.images[imageIndex]) {
            return photoCache.set(item.key, newAnalysis.images[imageIndex]);
          }
          return Promise.resolve();
        })
      );

      console.log('[Photo Agent] 개별 캐시 저장 완료');
    }

    // 결과 합치기 (원본 순서대로)
    const finalImages: any[] = [];

    // 캐시된 이미지들 먼저 추가
    cachedImages
      .sort((a, b) => a.idx - b.idx)
      .forEach(({ idx, data }) => {
        finalImages[idx] = data;
      });

    // 새로 분석된 이미지들 추가
    if (newAnalysis) {
      uncachedImages
        .sort((a, b) => a.idx - b.idx)
        .forEach((item, i) => {
          // newAnalysis.images는 정렬된 순서대로 있음
          const imageIndex = uncachedImages
            .sort((a, b) => a.idx - b.idx)
            .findIndex(u => u.idx === item.idx);

          if (imageIndex !== -1 && newAnalysis.images[imageIndex]) {
            finalImages[item.idx] = newAnalysis.images[imageIndex];
          }
        });
    }

    // 전체 PhotoAnalysis 구성
    const photoAnalysis: PhotoAnalysis = {
      images: finalImages,
      places: [...new Set(finalImages.flatMap((img: any) => img.places || []))],
      activities: [...new Set(finalImages.flatMap((img: any) => img.activities || []))],
      foods: [...new Set(finalImages.flatMap((img: any) => img.foods || []))],
      mood: finalImages.length > 0 ? (finalImages[0] as any).mood || '' : '',
      timeline: finalImages.flatMap((img: any) => img.timeline ? [img.timeline] : []),
    };

    console.log('[Photo Agent] 최종 결과 구성 완료');

    // 카테고리 순서로 이미지 재배열 (외관 → 내부 → 메뉴판 → 음식 → 디테일 컷)
    console.log('[Photo Agent] 카테고리 기반 이미지 정렬 시작...');

    // 정렬 전 원래 인덱스 저장
    const originalIndices = finalImages.map((img, i) => ({ originalIndex: i, category: getImageCategory(img) }));
    console.log('[Photo Agent] 정렬 전 순서:', originalIndices.map((item, i) => `${i + 1}. ${getCategoryName(item.category)} (idx:${item.originalIndex})`).join(', '));

    photoAnalysis.images = sortImagesByCategory(finalImages);

    // 정렬 후 원래 인덱스 순서 저장 (sortedImageOrder)
    photoAnalysis.sortedImageOrder = photoAnalysis.images.map(img => {
      // 정렬된 이미지의 현재 index는 새로운 위치
      // 원래 인덱스를 찾으려면 originalIndices에서 매칭해야 함
      // 각 이미지는 description 등으로 식별 가능
      const originalIndex = originalIndices.findIndex(item => {
        const originalImg = finalImages[item.originalIndex];
        return originalImg.description === img.description &&
               originalImg.scene === img.scene &&
               originalImg.view === img.view &&
               originalImg.focus === img.focus;
      });
      return originalIndex !== -1 ? originalIndices[originalIndex].originalIndex : img.index;
    });

    console.log('[Photo Agent] 정렬 후 순서:', photoAnalysis.images.map((img, i) => `${i + 1}. ${getCategoryName(getImageCategory(img))} (originalIdx:${photoAnalysis.sortedImageOrder![i]})`).join(', '));
    console.log('[Photo Agent] sortedImageOrder:', photoAnalysis.sortedImageOrder);
    console.log('[Photo Agent] 카테고리 기반 정렬 완료');

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
