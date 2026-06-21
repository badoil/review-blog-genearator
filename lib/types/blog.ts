// 블로그 글 타입
export interface BlogPost {
  title: string;
  content: string;
  url: string;
  author?: string;
  date?: string;
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
