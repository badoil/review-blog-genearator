import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import type { BlogState } from './state';
import { photoNode } from './nodes/photo-agent';
import { styleNode } from './nodes/style-agent';
import { groupingNode } from './nodes/grouping-node';
import { writerNode } from './nodes/writer-agent';
import { reviewerNode } from './nodes/reviewer-agent';
import { publisherNode } from './nodes/publisher-agent';
import type { UploadedImage } from '../types/photo';
import { CallbackHandler as LangfuseCallbackHandler } from '@langfuse/langchain';
import { Langfuse } from 'langfuse';

/**
 * Blog 생성을 위한 LangGraph 정의
 *
 * 아키텍처:
 *   (Photo + Style 병렬 실행) → Grouping → Writer → Reviewer → Publisher → END
 *
 * Photo Agent와 Style Agent는 병렬로 실행됩니다.
 */

// 노드 이름 상수
export const NODES = {
  PHOTO: 'photo',
  STYLE: 'style',
  GROUPING: 'grouping',
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
  // Photo Grouping 결과
  photoGrouping: Annotation<any | undefined>({
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
  const graph = new StateGraph(StateAnnotation)
  .addNode('grouping', groupingNode)
  .addNode('writer', writerNode)
  .addNode('reviewer', reviewerNode);

  // 엣지 추가: START → Grouping → Writer → Reviewer → END
  graph.addEdge(START, 'grouping');
  graph.addEdge('grouping', 'writer');
  graph.addEdge('writer', 'reviewer');
  graph.addEdge('reviewer', END);

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

  // Langfuse callback / SDK 설정 (환경 변수가 설정된 경우만)
  const hasLangfuseCredentials = Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);

  console.log('[Langfuse] LANGFUSE_PUBLIC_KEY:', process.env.LANGFUSE_PUBLIC_KEY);
  console.log('[Langfuse] LANGFUSE_SECRET_KEY:', process.env.LANGFUSE_SECRET_KEY);
  console.log('[Langfuse] LANGFUSE_PROJECT:', process.env.LANGFUSE_PROJECT);

  console.log('[Langfuse] Credentials:', hasLangfuseCredentials ? 'FOUND' : 'NOT FOUND');
  console.log('[Langfuse] Host:', process.env.LANGFUSE_BASE_URL || 'default (cloud.langfuse.com)');


  const langfuseClient = hasLangfuseCredentials
    ? new Langfuse({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL,
      })
    : undefined;

  console.log('[Langfuse] Client created:', !!langfuseClient);

    // LangfuseCallbackHandler는 환경 변수에서 자동으로 읽습니다
    // LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL
  const langfuseHandler = hasLangfuseCredentials
    ? new LangfuseCallbackHandler()
    : undefined;
  console.log('[Langfuse] Handler created:', langfuseHandler);
  console.log('[Langfuse] Handler state:', langfuseHandler ? {
    name: (langfuseHandler as any).name,
    hasLangfuse: !!(langfuseHandler as any).langfuse,
  } : 'N/A');


  // 초기 상태
  let state: BlogState = {
    images: uploadedImages,
    blogUrls,
    naverBlogId,
  };

  // Photo와 Style 병렬 실행
  console.log('[Langfuse] Starting Photo/Style nodes with callbacks:', !!langfuseHandler);
  const [photoResult, styleResult] = await Promise.all([
    photoNode(state, langfuseHandler ? { callbacks: [langfuseHandler] } : undefined).then(result => ({ ...result, nodeName: 'photo' })),
    styleNode(state, langfuseHandler ? { callbacks: [langfuseHandler] } : undefined).then(result => ({ ...result, nodeName: 'style' })),
  ]);
  console.log('[Langfuse] Photo/Style nodes completed');

  // 결과 병합
  state = {
    ...state,
    ...photoResult,
    ...styleResult,
  };

  // 에러 체크
  // if (state.error) {
  //   console.log('[Langfuse] Error occurred, flushing...');
  //   await langfuseClient?.flushAsync();
  //   return state;
  // }

  // 그래프 실행 (Grouping → Writer → Reviewer)
  console.log('[Langfuse] Starting graph execution with callbacks:', !!langfuseHandler);
  var result = null as unknown as BlogState; // 초기화
  const graph = createBlogGraph();
  try{
    result = await graph.invoke(state, langfuseHandler ? { callbacks: [langfuseHandler] } : {});
    console.log('[Langfuse] try completed', langfuseHandler);
  } catch (error) {
    console.error('[Langfuse] Graph execution error:', error);
  } finally {
    console.log('[Langfuse] finally completed', langfuseHandler);
    return result as BlogState;
}

  console.log('[Langfuse] Graph execution completed, flushing...');
  await langfuseClient?.flushAsync();
  console.log('[Langfuse] Flush completed');
  return result as BlogState;
}
