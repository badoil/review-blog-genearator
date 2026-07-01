import type { BlogState } from '../state';
import type { PhotoGroupingResult, PhotoGroup } from '../../types/photo';
import type { RunnableConfig } from '@langchain/core/runnables';

/**
 * Grouping Agent Node
 * Photo Analysis를 기반으로 mainItem 기반 1차 그룹핑 후
 * scene/view/focus 기반 2차 그룹핑 수행 (규칙 기반, LLM 없음)
 */
export async function groupingNode(
  state: BlogState,
  config?: RunnableConfig
): Promise<Partial<BlogState>> {
  const { photoAnalysis } = state;

  console.log('[Grouping Node] 시작');

  if (!photoAnalysis || !photoAnalysis.images) {
    return {
      error: '사진 분석 결과가 없습니다.',
    };
  }

  const images = photoAnalysis.images;
  console.log('[Grouping Node] 이미지 개수:', images.length);
  console.log('[Grouping Node] images 배열 구조:', images.map((img, i) => ({
    index: i,
    imgIndex: img.index,
    description: img.description,
    mainItem: img.mainItem,
    scene: img.scene,
    view: img.view,
    focus: img.focus,
    category: img.category,
    time: img.time,
    location: img.location
  })));

  try {
    // 1. 업로드 순서대로 같은 mainItem끼리 1차 그룹화
    const preliminaryGroups: Map<string, number[]> = new Map();

    images.forEach((img, index) => {
      const mainItem = img.mainItem || 'unknown';
      if (!preliminaryGroups.has(mainItem)) {
        preliminaryGroups.set(mainItem, []);
      }
      preliminaryGroups.get(mainItem)!.push(index);
    });

    console.log('[Grouping Node] 1차 그룹화 결과:');
    preliminaryGroups.forEach((indices, mainItem) => {
      console.log(`  ${mainItem}: ${indices.length}장 [${indices.join(', ')}]`);
    });

    // 2. 같은 mainItem이 2장 이상이면 scene/view/focus 기반 세부 그룹핑
    const finalGroups: PhotoGroup[] = [];
    let groupIndex = 0;

    for (const [mainItem, indices] of preliminaryGroups) {
      if (indices.length >= 2) {
        // scene/view/focus 기반 규칙형 그룹핑
        console.log(`[Grouping Node] ${mainItem} ${indices.length}장 - scene/view/focus 기반 그룹핑 시작`);
        const imagesForGrouping = indices
          .map(idx => images[idx])
          .filter((img): img is Exclude<typeof img, undefined> => img != null);

        console.log(`[Grouping Node] 그룹핑용 이미지: ${imagesForGrouping.length}장 (원래 ${indices.length}장)`);

        // 유효한 이미지의 원본 인덱스 추적
        const validIndices = indices
          .map((idx, i) => images[idx] != null ? idx : -1)
          .filter((idx): idx is number => idx !== -1);

        console.log(`[Grouping Node] 유효한 인덱스:`, validIndices);

        const subGroups = groupByScene(
          imagesForGrouping,
          mainItem
        );

        // 결과를 PhotoGroup으로 변환
        // subGroups에는 imagesForGrouping의 상대 인덱스가 들어있음
        subGroups.forEach((subGroup) => {
          // 상대 인덱스를 원본 인덱스로 변환
          const originalIndices = subGroup.map(relIdx => validIndices[relIdx]);

          // 원본 인덱스로 이미지 가져오기
          const groupImages = originalIndices
            .map(idx => images[idx])
            .filter((img): img is Exclude<typeof img, undefined> => img != null);

          finalGroups.push(createPhotoGroup(
            groupIndex++,
            mainItem,
            originalIndices,
            groupImages
          ));
        });
      } else {
        // 1장이면 그대로 그룹 생성
        const img = images[indices[0]];
        finalGroups.push(createPhotoGroup(
          groupIndex++,
          mainItem,
          indices,
          [img]
        ));
      }
    }

    // 업로드 순서 정렬
    finalGroups.sort((a, b) => a.imageIndices[0] - b.imageIndices[0]);

    console.log('[Grouping Node] 최종 그룹:', finalGroups.map(g => ({
      id: g.id,
      mainItem: g.mainItem,
      count: g.imageIndices.length,
      indices: g.imageIndices
    })));

    return {
      photoGrouping: {
        groups: finalGroups,
      },
    };
  } catch (error) {
    console.error('[Grouping Node] 그룹핑 실패:', error);
    return {
      error: `그룹핑 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}

/**
 * Scene/View/Focus 기반 규칙형 그룹핑
 *
 * LLM 호출 없이 scene, view, focus 필드를 기반으로 규칙 기반 그룹핑 수행
 * 입력된 images 배열의 상대적 위치(0, 1, 2...)를 사용하여 그룹핑합니다.
 */
function groupByScene(
  images: Array<{
    index: number;
    scene?: string;
    view?: string;
    focus?: string;
    mainItem?: string;
    description?: string;
  }>,
  mainItem: string
): number[][] {
  console.log('[Grouping Node] groupByScene 호출:');
  console.log('  - mainItem:', mainItem);
  console.log('  - images.length:', images.length);

  // Step 1: scene 기반 그룹화
  const sceneGroups: Map<string, number[]> = new Map();

  images.forEach((img, idx) => {
    const scene = img.scene || 'unknown';
    const key = `${mainItem}:${scene}`;

    if (!sceneGroups.has(key)) {
      sceneGroups.set(key, []);
    }
    sceneGroups.get(key)!.push(idx);
  });

  console.log('[Grouping Node] scene 기반 그룹화 결과:');
  sceneGroups.forEach((indices, key) => {
    console.log(`  ${key}: ${indices.length}장 [${indices.join(', ')}]`);
  });

  // Step 2: view/focus 기반 최종 병합
  const finalGroups: number[][] = [];

  sceneGroups.forEach((indices) => {
    if (indices.length === 1) {
      finalGroups.push(indices);
    } else {
      const subGroups = mergeByViewAndFocus(images, indices);
      finalGroups.push(...subGroups);
    }
  });

  console.log('[Grouping Node] 최종 그룹핑 결과 (상대 인덱스):', finalGroups);
  return finalGroups;
}

/**
 * 같은 scene 내에서 view/focus 기반 병합/분리
 * 인접한 이미지들의 view와 focus를 비교하여 병합 여부 결정
 */
function mergeByViewAndFocus(
  images: Array<{
    view?: string;
    focus?: string;
  }>,
  indices: number[]
): number[][] {
  const groups: number[][] = [];
  let currentGroup: number[] = [indices[0]];

  for (let i = 1; i < indices.length; i++) {
    const prevImg = images[indices[i - 1]];
    const currImg = images[indices[i]];

    // view나 focus가 다르면 분리
    const viewMatch = prevImg.view === currImg.view;
    const focusMatch = prevImg.focus === currImg.focus;

    if (!viewMatch || !focusMatch) {
      // 분리
      groups.push(currentGroup);
      currentGroup = [indices[i]];
      console.log(`[Grouping Node] 분리: idx${indices[i - 1]} vs idx${indices[i]} (view: ${prevImg.view}→${currImg.view}, focus: ${prevImg.focus}→${currImg.focus})`);
    } else {
      // 병합
      currentGroup.push(indices[i]);
      console.log(`[Grouping Node] 병합: idx${indices[i - 1]} + idx${indices[i]} (view: ${prevImg.view}, focus: ${prevImg.focus})`);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * PhotoGroup 생성 헬퍼
 */
function createPhotoGroup(
  index: number,
  mainItem: string,
  imageIndices: number[],
  images: Array<{ description?: string; category?: string; time?: string; location?: string }>
): PhotoGroup {
  const category = images[0]?.category || 'other';
  const time = images[0]?.time;
  const location = images[0]?.location;

  // description들을 합쳐서 그룹 description 생성
  const descriptions = images
    .map(img => img.description)
    .filter((d): d is string => !!d)
    .join(', ');

  return {
    id: `group-${index + 1}`,
    title: mainItem,
    description: descriptions || mainItem,
    imageIndices,
    category,
    mainItem,
    time,
    location,
  };
}
