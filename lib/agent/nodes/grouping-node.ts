import type { BlogState } from '../state';
import type { PhotoGroupingResult, PhotoGroup } from '../../types/photo';
import { getGLMService } from '../../services/glm.service';

/**
 * Grouping Agent Node
 * Photo Analysis를 기반으로 mainItem 기반 그룹핑 수행
 * 같은 mainItem이 2장 이상이면 LLM으로 description 분석 후 그룹핑
 */
export async function groupingNode(state: BlogState): Promise<Partial<BlogState>> {
  const { photoAnalysis } = state;

  console.log('[Grouping Node] 시작');

  if (!photoAnalysis || !photoAnalysis.images) {
    return {
      error: '사진 분석 결과가 없습니다.',
    };
  }

  const images = photoAnalysis.images;
  console.log('[Grouping Node] 이미지 개수:', images.length);

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
        const subGroups = await groupByDescription(
          indices.map(idx => images[idx]),
          mainItem
        );

        // 결과를 PhotoGroup으로 변환
        subGroups.forEach((subGroup, subIdx) => {
          const groupImages = subGroup.map(idx => images[idx]);
          finalGroups.push(createPhotoGroup(
            groupIndex++,
            mainItem,
            subGroup,
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
 */
async function groupByDescription(
  images: Array<{ index: number; description?: string; mainItem?: string }>,
  mainItem: string
): Promise<number[][]> {
  const glm = getGLMService();

  const systemPrompt = `당신은 사진 그룹핑 전문가입니다.
주어진 사진들의 description을 보고, **1-3장씩** 자연스럽게 그룹화해주세요.
같은 description이거나 비슷한 상황/컨텍스트의 사진들을 같은 그룹으로 묶으세요.

**중요:**
- 한 그룹은 1~3장으로 구성하세요
- description이 다르면 분리하세요 (예: "조리 중" vs "완성된 접시")
- 업로드 순서를 유지하세요`;

  const imagesInfo = images.map(img => ({
    index: img.index,
    description: img.description || '',
  }));

  const userPrompt = `다음 ${images.length}장의 사진을 1-3장씩 자연스럽게 그룹화해주세요.

메인 아이템: ${mainItem}

사진 정보:
${imagesInfo.map((img, i) => `#${img.index}: ${img.description}`).join('\n')}

**출력 형식 (JSON만):**
[
  [0, 1],    // 그룹 1: 인덱스 0, 1
  [2, 3, 4]  // 그룹 2: 인덱스 2, 3, 4
]

중요: JSON 배열 형식으로만 응답해주세요. 설명을 추가하지 마세요.`;

  try {
    const response = await glm.generateText(systemPrompt, userPrompt);

    // JSON 파싱
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('JSON 응답을 찾을 수 없습니다.');
    }

    const groups = JSON.parse(jsonMatch[0]) as number[][];

    console.log('[Grouping Node] LLM 그룹핑 결과:', groups);
    return groups;
  } catch (error) {
    console.error('[Grouping Node] LLM 그룹핑 실패, 기본 그룹핑 사용:', error);
    // 실패하면 기본적으로 3장씩 분할
    const groups: number[][] = [];
    for (let i = 0; i < images.length; i += 3) {
      groups.push(images.slice(i, i + 3).map(img => img.index));
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
