import type { BlogState } from '../state';
import type { PhotoGroupingResult, PhotoGroup } from '../../types/photo';
import { getGLMService } from '../../services/glm.service';
import type { RunnableConfig } from '@langchain/core/runnables';

/**
 * Grouping Agent Node
 * Photo Analysis를 기반으로 mainItem 기반 그룹핑 수행
 * 같은 mainItem이 2장 이상이면 LLM으로 description 분석 후 그룹핑
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

    // 2. 같은 mainItem이 2장 이상이면 LLM으로 세부 그룹핑
    const finalGroups: PhotoGroup[] = [];
    let groupIndex = 0;

    for (const [mainItem, indices] of preliminaryGroups) {
      if (indices.length >= 2) {
        // LLM으로 description 기반 그룹핑
        console.log(`[Grouping Node] ${mainItem} ${indices.length}장 - LLM 그룹핑 시작`);
        const imagesForGrouping = indices
          .map(idx => images[idx])
          .filter((img): img is Exclude<typeof img, undefined> => img != null);

        console.log(`[Grouping Node] 그룹핑용 이미지: ${imagesForGrouping.length}장 (원래 ${indices.length}장)`);

        // 유효한 이미지의 원본 인덱스 추적
        const validIndices = indices
          .map((idx, i) => images[idx] != null ? idx : -1)
          .filter((idx): idx is number => idx !== -1);

        console.log(`[Grouping Node] 유효한 인덱스:`, validIndices);

        const subGroups = await groupByDescription(
          imagesForGrouping,
          mainItem,
          config
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
 * LLM으로 description 기반 그룹핑
 *
 * 중요: 입력된 images 배열의 상대적 위치(0, 1, 2...)를 사용하여 그룹핑합니다.
 * 반환값은 호출 시점의 images 배열 인덱스(상대 인덱스)입니다.
 */
async function groupByDescription(
  images: Array<{ index: number; description?: string; mainItem?: string }>,
  mainItem: string,
  config?: RunnableConfig
): Promise<number[][]> {
  const glm = getGLMService();

  console.log('[Grouping Node] groupByDescription 호출:');
  console.log('  - mainItem:', mainItem);
  console.log('  - images.length:', images.length);
  console.log('  - 입력된 images의 img.index:', images.map((img, i) => ({ arrayIdx: i, imgIndex: img.index })));

  const systemPrompt = `당신은 사진 그룹핑 전문가입니다.
주어진 사진들의 description을 보고, **1-3장씩** 자연스럽게 그룹화해주세요.
같은 description이거나 비슷한 상황/컨텍스트의 사진들을 같은 그룹으로 묶으세요.

**중요:**
- 한 그룹은 1~3장으로 구성하세요
- description이 다르면 분리하세요 (예: "조리 중" vs "완성된 접시")
- 업로드 순서를 유지하세요`;

  // 상대적 인덱스(0, 1, 2...)를 사용하여 LLM에 요청
  const validImages = images.filter(img => img != null);
  const userPrompt = `다음 ${validImages.length}장의 사진을 1-3장씩 자연스럽게 그룹화해주세요.

메인 아이템: ${mainItem}

사진 정보:
${validImages.map((img, i) => `#${i}: ${img.description || ''}`).join('\n')}

**출력 형식 (JSON만):**
[
  [0, 1],    // 그룹 1: 상대 인덱스 0, 1 (첫 번째, 두 번째 사진)
  [2, 3]     // 그룹 2: 상대 인덱스 2, 3 (세 번째, 네 번째 사진)
]

중요:
- JSON 배열 형식으로만 응답해주세요. 설명을 추가하지 마세요.
- 반드시 0부터 시작하는 상대적 인덱스를 사용하세요.`;

  try {
    const response = await glm.generateText(systemPrompt, userPrompt, config);

    // JSON 파싱
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('JSON 응답을 찾을 수 없습니다.');
    }

    const groups = JSON.parse(jsonMatch[0]) as number[][];

    console.log('[Grouping Node] LLM 그룹핑 결과 (상대 인덱스):', groups);
    console.log('[Grouping Node] 반환값은 입력 images 배열의 인덱스입니다');

    // 상대 인덱스를 그대로 반환 (호출하는 쪽에서 사용)
    return groups;
  } catch (error) {
    console.error('[Grouping Node] LLM 그룹핑 실패, 기본 그룹핑 사용:', error);
    // 실패하면 기본적으로 3장씩 분할 (상대 인덱스 반환)
    const groups: number[][] = [];
    for (let i = 0; i < validImages.length; i += 3) {
      const group: number[] = [];
      for (let j = 0; j < 3 && i + j < validImages.length; j++) {
        group.push(i + j);  // 상대 인덱스 사용
      }
      if (group.length > 0) {
        groups.push(group);
      }
    }
    return groups;
  }
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
