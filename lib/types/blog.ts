// 블로그 글 타입
export interface ImageTextPair {
  imageUrl: string;      // 이미지 URL
  altText: string;       // 이미지 대체 텍스트
  textAfter: string;     // 이미지 다음에 오는 텍스트 (문장 수로 환산 가능)
}

export interface BlogPost {
  title: string;
  content: string;
  url: string;
  author?: string;
  date?: string;
  imageTextPairs?: ImageTextPair[];  // 이미지-텍스트 쌍
}

// 최종 블로그 글
export interface FinalPost {
  title: string;
  content: string;
  tags: string[];
}

// 네이버 로그인 정보
export interface NaverCredentials {
  id: string;
  password: string;
}

// 업로드 결과
export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}
