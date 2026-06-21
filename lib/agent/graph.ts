import { StateGraph, END } from '@langchain/langgraph';
import type { BlogState } from './state';
import { photoNode } from './nodes/photo-agent';
import { styleNode } from './nodes/style-agent';
import { writerNode } from './nodes/writer-agent';
import { reviewerNode } from './nodes/reviewer-agent';

/**
 * Blog 생성을 위한 LangGraph 정의
 *
 * 아키텍처:
 *   (Photo + Style 병렬 실행) → Writer → Reviewer → END
 *
 * Photo Agent와 Style Agent는 병렬로 실행됩니다.
 */

// 노드 이름 상수
export const NODES = {
  PHOTO: 'photo',
  STYLE: 'style',
  WRITER: 'writer',
  REVIEWER: 'reviewer',
} as const;

/**
 * Blog 생성 그래프 생성
 * Writer와 Reviewer만 포함합니다.
 * Photo와 Style는 병렬로 실행됩니다.
 */
export function createBlogGraph(): StateGraph<BlogState> {
  // StateGraph 정의
  const graph = new StateGraph<BlogState>({
    channels: {
      // 입력
      images: {
        default: () => [],
        reducer: (x, y) => y ?? x,
      },
      blogUrls: {
        default: () => [],
        reducer: (x, y) => y ?? x,
      },
      // 병렬 실행 결과
      photoAnalysis: {
        default: () => undefined,
        reducer: (x, y) => y ?? x,
      },
      styleProfile: {
        default: () => undefined,
        reducer: (x, y) => y ?? x,
      },
      // 참고 블로그 내용
      referencePosts: {
        default: () => undefined,
        reducer: (x, y) => y ?? x,
      },
      // 순차 실행 결과
      draft: {
        default: () => undefined,
        reducer: (x, y) => y ?? x,
      },
      finalPost: {
        default: () => undefined,
        reducer: (x, y) => y ?? x,
      },
      imagePlacements: {
        default: () => undefined,
        reducer: (x, y) => y ?? x,
      },
      // 네이버 업로드 결과
      uploadResult: {
        default: () => undefined,
        reducer: (x, y) => y ?? x,
      },
      // 에러 처리
      error: {
        default: () => undefined,
        reducer: (x, y) => y ?? x,
      },
    },
  });

  // 노드 추가 (Writer와 Reviewer만)
  graph.addNode(NODES.WRITER, writerNode);
  graph.addNode(NODES.REVIEWER, reviewerNode);

  // 엣지 추가
  // Writer가 완료되면 Reviewer로
  graph.addEdge(NODES.WRITER, NODES.REVIEWER);

  // Reviewer가 완료되면 END
  graph.addEdge(NODES.REVIEWER, END);

  // 시작점 설정
  graph.setEntryPoint(NODES.WRITER);

  // 그래프 컴파일
  return graph.compile();
}

/**
 * 그래프 실행을 위한 헬퍼 함수
 * Photo와 Style를 병렬로 실행한 후 그래프를 실행합니다.
 */
export async function generateBlogPost(
  images: Array<{ path: string; base64?: string }>,
  blogUrls: string[]
): Promise<BlogState> {
  // 초기 상태
  let state: BlogState = {
    images,
    blogUrls,
  };

  // Photo와 Style 병렬 실행
  const [photoResult, styleResult] = await Promise.all([
    photoNode(state).then(result => ({ ...result, nodeName: 'photo' })),
    styleNode(state).then(result => ({ ...result, nodeName: 'style' })),
  ]);

  // 결과 병합
  state = {
    ...state,
    ...photoResult,
    ...styleResult,
  };

  // 에러 체크
  if (state.error) {
    return state;
  }

  // 그래프 실행 (Writer → Reviewer)
  const graph = createBlogGraph();
  const result = await graph.invoke(state);

  return result;
}
