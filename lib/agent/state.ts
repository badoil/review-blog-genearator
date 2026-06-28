import type { UploadedImage } from '../types/photo';
import type { StyleProfile } from '../types/style';
import type { PhotoAnalysis, PhotoGroupingResult } from '../types/photo';
import type { UploadResult } from '../types/blog';

// 이미지 배치 정보
export interface ImagePlacement {
  imageIndex: number;  // images 배열의 인덱스
  position: 'before' | 'after' | 'replace';  // 배치 위치
  targetText?: string;  // position이 'replace'일 때 교체할 텍스트
  insertIndex?: number;  // 글에서 삽입할 위치 (문단 번호)
}

// LangGraph State 인터페이스
export interface BlogState {
  // 입력
  images: UploadedImage[];
  blogUrls: string[];
  naverBlogId?: string;  // 네이버 블로그 ID (발행용)

  // 병렬 실행 결과
  photoAnalysis?: PhotoAnalysis;
  styleProfile?: StyleProfile;

  // Photo Grouping 결과
  photoGrouping?: PhotoGroupingResult;

  // 참고 블로그 내용 (리뷰어에서 비교용)
  referencePosts?: string;

  // 순차 실행 결과
  draft?: string;
  finalPost?: string;
  imagePlacements?: ImagePlacement[];  // 이미지 배치 정보

  // 네이버 발행 결과
  uploadResult?: UploadResult;
  publishedUrl?: string;  // 발행된 글 URL

  // 에러 처리
  error?: string;
}
