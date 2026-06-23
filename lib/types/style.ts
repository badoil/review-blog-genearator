// 스타일 프로필
export interface StyleProfile {
  tone: string;
  endingPattern: string;
  emojiLevel: number; // 0-3
  paragraphLength: 'short' | 'medium' | 'long';
  writingStyle: string;

  // 추가된 심층 분석 필드
  commonPhrases?: string[];      // 자주 사용하는 표현
  sentenceStyle?: string;        // 문장 스타일
  punctuation?: string;          // 문장 부호 사용 습관

  // 섹션별 텍스트 길이 분석
  sectionTextLength?: {
    perSection: number[];      // 각 섹션별 텍스트 길이 (문장 수)
    average: number;           // 평균 텍스트 길이
    min: number;               // 최소 길이
    max: number;               // 최대 길이
  };
}

// 글쓰기 스타일 분석
export interface WritingStyle {
  formality: 'formal' | 'casual' | 'mixed';
  sentenceLength: number;
  useEmojis: boolean;
  commonPhrases: string[];
}
