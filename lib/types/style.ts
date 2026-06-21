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
}

// 글쓰기 스타일 분석
export interface WritingStyle {
  formality: 'formal' | 'casual' | 'mixed';
  sentenceLength: number;
  useEmojis: boolean;
  commonPhrases: string[];
}
