import type { ImageAnalysis } from '../types/photo';
import { PhotoDisplayCategory, CATEGORY_ORDER } from '../types/photo';

/**
 * Category Mapping Result
 */
interface CategoryMappingResult {
  category: PhotoDisplayCategory;
  confidence: number;  // 0-1 score for mapping certainty
  matchedOn: 'scene' | 'view' | 'focus' | 'fallback';
}

/**
 * scene/view/focus 값을 PhotoDisplayCategory로 매핑
 *
 * 매핑 우선순위 (cascade):
 * 1. MENU: scene에 "메뉴판" 또는 "간판" 포함
 * 2. EXTERIOR: scene에 "건물 외관" 또는 focus가 "건물"/"간판" + view가 전경/중거리
 * 3. INTERIOR: scene에 "실내 내부"/"인테리어"/"야외 좌석" 또는 focus가 "파라솔"/"정원"
 * 4. DETAIL: view가 "클로즈업" + focus가 "음식"
 * 5. FOOD: scene에 "테이블 위 음식" + view가 전경/중거리
 * 6. Fallback: 기본값은 INTERIOR
 */
export function mapToDisplayCategory(
  scene?: string,
  view?: string,
  focus?: string
): PhotoDisplayCategory {
  // 1. MENU: Highest priority - check scene first
  if (scene?.includes('메뉴판') || scene?.includes('간판')) {
    return PhotoDisplayCategory.MENU;
  }
  if (focus === '간판' && view === '클로즈업') {
    return PhotoDisplayCategory.MENU;
  }

  // 2. EXTERIOR: Building exterior/entrance
  if (scene?.includes('건물 외관') || scene?.includes('입구') || scene?.includes('파사드')) {
    return PhotoDisplayCategory.EXTERIOR;
  }
  if ((focus === '건물' || focus === '간판') && (view === '전경' || view === '중거리')) {
    return PhotoDisplayCategory.EXTERIOR;
  }

  // 3. INTERIOR: Interior + outdoor seating
  if (scene?.includes('실내 내부') || scene?.includes('인테리어') ||
      scene?.includes('야외 좌석') || scene?.includes('주방')) {
    return PhotoDisplayCategory.INTERIOR;
  }
  if (focus === '파라솔' || focus === '정원') {
    return PhotoDisplayCategory.INTERIOR;
  }

  // 4. DETAIL: Close-up food shots
  if (view === '클로즈업' && focus === '음식') {
    return PhotoDisplayCategory.DETAIL;
  }
  // 테이블 위 음식 + 클로즈업 = DETAIL
  if (scene?.includes('테이블 위 음식') && view === '클로즈업') {
    return PhotoDisplayCategory.DETAIL;
  }
  // 일반 클로즈업은 디테일로 처리 (음식 관련일 가능성 높음)
  if (view === '클로즈업') {
    return PhotoDisplayCategory.DETAIL;
  }

  // 5. FOOD: Table food shots (wide/medium distance)
  if (scene?.includes('테이블 위 음식')) {
    return PhotoDisplayCategory.FOOD;
  }
  if (focus === '음식' && (view === '전경' || view === '중거리')) {
    return PhotoDisplayCategory.FOOD;
  }

  // 6. Fallback: Default to INTERIOR for unknown
  return PhotoDisplayCategory.INTERIOR;
}

/**
 * 이미지를 카테고리 순서로 정렬
 *
 * @param images - 정렬할 이미지 배열
 * @returns 카테고리 순서로 정렬된 새로운 배열 (원본은 수정하지 않음)
 */
export function sortImagesByCategory(images: ImageAnalysis[]): ImageAnalysis[] {
  // 복사본 생성
  const sortedImages = [...images];

  // 카테고리 순서로 정렬
  sortedImages.sort((a, b) => {
    const categoryA = mapToDisplayCategory(a.scene, a.view, a.focus);
    const categoryB = mapToDisplayCategory(b.scene, b.view, b.focus);

    const orderA = CATEGORY_ORDER.indexOf(categoryA);
    const orderB = CATEGORY_ORDER.indexOf(categoryB);

    // 카테고리 순서 우선, 같으면 원래 index 유지 (stable sort)
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.index - b.index;
  });

  // 정렬 후 index 필드 업데이트
  sortedImages.forEach((img, newIndex) => {
    img.index = newIndex;
  });

  return sortedImages;
}

/**
 * 이미지의 카테고리를 가져오는 유틸리티 함수 (로깅용)
 */
export function getImageCategory(image: ImageAnalysis): PhotoDisplayCategory {
  return mapToDisplayCategory(image.scene, image.view, image.focus);
}

/**
 * 카테고리 이름을 한국어로 변환 (로깅용)
 */
export function getCategoryName(category: PhotoDisplayCategory): string {
  const names: Record<PhotoDisplayCategory, string> = {
    [PhotoDisplayCategory.EXTERIOR]: '외관',
    [PhotoDisplayCategory.INTERIOR]: '내부',
    [PhotoDisplayCategory.MENU]: '메뉴판',
    [PhotoDisplayCategory.FOOD]: '음식',
    [PhotoDisplayCategory.DETAIL]: '디테일 컷',
  };
  return names[category];
}
