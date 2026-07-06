// 업로드된 이미지
export interface UploadedImage {
  path: string;
  filename: string;
  buffer?: Buffer;
  base64?: string;
}

// 카테고리 기반 사진 정렬을 위한 표시 카테고리
export enum PhotoDisplayCategory {
  EXTERIOR = 'exterior',      // 외관 - 건물 외관, 간판/입구
  INTERIOR = 'interior',      // 내부 - 실내 내부, 인테리어, 야외 좌석
  MENU = 'menu',              // 메뉴판 - 메뉴판 사진
  FOOD = 'food',              // 음식 - 테이블 위 음식 (전체)
  DETAIL = 'detail'           // 디테일 컷 - 음식 디테일/클로즈업
}

// 카테고리 표시 순서 (외관 → 내부 → 메뉴판 → 음식 → 디테일 컷)
export const CATEGORY_ORDER: PhotoDisplayCategory[] = [
  PhotoDisplayCategory.EXTERIOR,
  PhotoDisplayCategory.INTERIOR,
  PhotoDisplayCategory.MENU,
  PhotoDisplayCategory.FOOD,
  PhotoDisplayCategory.DETAIL
];

// 개별 이미지 분석 결과
export interface ImageAnalysis {
  index: number;           // 이미지 순서 (0-based)
  description: string;      // 이미지 전체 설명
  places: string[];         // 이 이미지에서 식별된 장소
  activities: string[];     // 이 이미지에서 식별된 활동
  foods: string[];          // 이 이미지에서 식별된 음식
  time?: string;            // 추정 시간대 (아침, 점심, 저녁 등)
  location?: string;        // 구체적 장소 이름

  // Photo Grouping용 필드
  category: 'food' | 'activity' | 'place' | 'transport' | 'other';
  mainItem: string;        // 그룹핑용 단일 키 (예: '타코야끄', '산책', '카페')

  // Scene/View/Focus 기반 그룹핑용 필드
  scene?: string;          // 장면 (예: "야외 좌석", "건물 외관", "실내 내부", "테이블 위 음식")
  view?: string;           // 촬영 거리/각도 (예: "전경", "중거리", "클로즈업", "측면")
  focus?: string;          // 초점 대상 (예: "파라솔", "건물", "음식", "사람", "정원")
  people?: boolean;        // 사람 포함 여부
}

// 사진 분석 결과 (전체 + 개별)
export interface PhotoAnalysis {
  images: ImageAnalysis[];  // 각 이미지별 분석 결과 (순서대로)
  places: string[];          // 전체 장소 목록 (중복 제거)
  activities: string[];      // 전체 활동 목록 (중복 제거)
  foods: string[];           // 전체 음식 목록 (중복 제거)
  mood: string;              // 전체 분위기
  timeline: TimelineItem[]; // 동선 요약
  sortedImageOrder?: number[]; // 카테고리 정렬 후의 이미지 순서 (원래 인덱스 배열)
  // 예: 업로드 순서 [0,1,2,3]이 정렬 후 [2,0,3,1]이 되면 sortedImageOrder = [2,0,3,1]
}

export interface TimelineItem {
  time?: string;
  location?: string;
  activity?: string;
}

// 이미지 배치 정보
export interface ImagePlacement {
  imageIndex: number;           // 이미지 순서 (0-based)
  position: 'before' | 'after'; // 섹션의 앞/뒤 배치
  sectionTitle: string;         // 섹션 제목 (예: "섹션 1", "섹션 2")
  sectionContent?: string;      // 섹션 내용 요약 (선택)
}

// Photo Grouping 관련 타입
export interface PhotoGroup {
  id: string;                    // 그룹 ID (group-1, group-2...)
  title: string;                 // 그룹 제목 (예: "타코야끄와 맥주")
  description: string;           // 그룹 설명
  imageIndices: number[];        // 포함된 이미지 인덱스 (업로드 순서)
  category: string;              // 카테고리
  mainItem: string;              // 그룹핑 키
  time?: string;                 // 시간대
  location?: string;             // 장소
}

export interface PhotoGroupingResult {
  groups: PhotoGroup[];          // 그룹 목록 (업로드 순서 유지)
}
