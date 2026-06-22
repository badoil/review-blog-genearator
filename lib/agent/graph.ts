import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import type { BlogState } from './state';
import { photoNode } from './nodes/photo-agent';
import { styleNode } from './nodes/style-agent';
import { writerNode } from './nodes/writer-agent';
import { reviewerNode } from './nodes/reviewer-agent';
import { publisherNode } from './nodes/publisher-agent';
import type { UploadedImage } from '../types/photo';


/**
 * Blog 생성을 위한 LangGraph 정의
 *
 * 아키텍처:
 *   (Photo + Style 병렬 실행) → Writer → Reviewer → Publisher → END
 *
 * Photo Agent와 Style Agent는 병렬로 실행됩니다.
 */

// 노드 이름 상수
export const NODES = {
  PHOTO: 'photo',
  STYLE: 'style',
  WRITER: 'writer',
  REVIEWER: 'reviewer',
  PUBLISHER: 'publisher',
} as const;

/**
 * State Annotation 정의
 * LangGraph 최신 버전에서 Annotation 방식 사용
 */
const StateAnnotation = Annotation.Root({
  // 입력
  images: Annotation<any[]>({
    default: () => [],
    reducer: (x, y) => y ?? x,
  }),
  blogUrls: Annotation<string[]>({
    default: () => [],
    reducer: (x, y) => y ?? x,
  }),
  naverBlogId: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (x, y) => y ?? x,
  }),
  // 병렬 실행 결과
  photoAnalysis: Annotation<any>({
    default: () => undefined,
    reducer: (x, y) => y ?? x,
  }),
  styleProfile: Annotation<any>({
    default: () => undefined,
    reducer: (x, y) => y ?? x,
  }),
  // 참고 블로그 내용
  referencePosts: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (x, y) => y ?? x,
  }),
  // 순차 실행 결과
  draft: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (x, y) => y ?? x,
  }),
  finalPost: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (x, y) => y ?? x,
  }),
  imagePlacements: Annotation<any[] | undefined>({
    default: () => undefined,
    reducer: (x, y) => y ?? x,
  }),
  // 네이버 발행 결과
  uploadResult: Annotation<any | undefined>({
    default: () => undefined,
    reducer: (x, y) => y ?? x,
  }),
  publishedUrl: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (x, y) => y ?? x,
  }),
  // 에러 처리
  error: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (x, y) => y ?? x,
  }),
});

/**
 * Blog 생성 그래프 생성
 */
export function createBlogGraph() {
  // StateGraph 정의 (새로운 API)
  // const graph = new StateGraph(StateAnnotation);

  // // 노드 추가
  // graph.addNode('writer', writerNode);
  // graph.addNode('reviewer', reviewerNode);
  // graph.addNode('publisher', publisherNode);
  const graph = new StateGraph(StateAnnotation)
  .addNode('writer', writerNode)
  .addNode('reviewer', reviewerNode)
  .addNode('publisher', publisherNode);


  // 엣지 추가
 graph.addEdge(START, 'writer');
 graph.addEdge('writer', 'reviewer');
 graph.addEdge('reviewer', 'publisher');
 graph.addEdge('publisher', END);
 

  // 그래프 컴파일
  return graph.compile();
}

/**
 * 그래프 실행을 위한 헬퍼 함수
 * Photo와 Style를 병렬로 실행한 후 그래프를 실행합니다.
 */
export async function generateBlogPost(
  images: Array<{ path: string; base64?: string }>,
  blogUrls: string[],
  naverBlogId?: string
): Promise<BlogState> {
  const uploadedImages: UploadedImage[] = images.map(img => ({
  path: img.path,
  filename: img.path.split('/').pop() || 'image.jpg',
  base64: img.base64,
}));
  // 초기 상태
  let state: BlogState = {
    images: uploadedImages,
    blogUrls,
    naverBlogId,
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

  // 그래프 실행 (Writer → Reviewer → Publisher)
  const graph = createBlogGraph();
  const result = await graph.invoke(state);

  return result as BlogState;
}
