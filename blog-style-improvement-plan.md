# 블로그 글 스타일 및 구조 정확도 개선 계획

## Context

사용자가 참고 블로그와 비교했을 때:
1. 생성된 글이 **너무 김**
2. **문체가 다름**
3. **구조가 다름**

현재 시스템은 8개 스타일 요소를 추출하지만 **길이/구조 분석이 부족**함.

---

## 해결 방법

### 1. Type Definitions (`lib/types/style.ts`)

새 인터페이스 추가:

```typescript
// 길이 메트릭
export interface LengthMetrics {
  totalSentences: number;          // 총 문장 수
  sentencesPerImage: number;        // 이미지당 문장 수
  sentencesPerSection: number;      // 섹션당 문장 수
  avgParagraphLength: number;       // 문단당 문장 수
  avgCharsPerSection: number;       // 섹션당 글자 수
  postLengthRange: { min: number; max: number };
}

// 구조 프로필
export interface StructureProfile {
  sectionCount: number;             // 섹션 수
  sectionTypes: string[];           // 섹션 유형들
  hasIntroduction: boolean;
  hasConclusion: boolean;
  headerUsagePattern: "frequent" | "sparse" | "none";
  imagePlacementPattern: string;
  introLength: number;             // 도입부 문장 수
  conclusionLength: number;         // 마무리 문장 수
}

// 문장 구조
export interface SentenceStructure {
  avgSentenceLength: number;
  sentenceLengthDistribution: { short: number; medium: number; long: number; };
  commonConjunctions: string[];
  clausePatterns: string[];
  commonConnectors: string[];
}
```

`StyleProfile` 확장 (모든 새 필드는 optional):

```typescript
export interface StyleProfile {
  // 기존 필드...
  tone: string;
  endingPattern: string;
  emojiLevel: number;
  paragraphLength: 'short' | 'medium' | 'long';
  writingStyle: string;
  commonPhrases?: string[];
  sentenceStyle?: string;
  punctuation?: string;

  // 새 필드 (optional)
  lengthMetrics?: LengthMetrics;
  structureProfile?: StructureProfile;
  sentenceStructure?: SentenceStructure;
}
```

---

### 2. Style Agent Enhancement (`lib/agent/nodes/style-agent.ts`)

**시스템 프롬프트 업데이트** - 새 필드 분석 지시:

```typescript
const systemPrompt = `...기존 내용...

// 새로운 분석 필드 추가
"lengthMetrics": {
  "totalSentences": 총 문장 수 (실제 개수),
  "sentencesPerImage": 이미지당 평균 문장 수,
  ...
},
"structureProfile": {
  "sectionCount": 섹션 수 (실제 개수),
  "sectionTypes": ["도입부", "본문", "마무리"],
  ...
},
"sentenceStructure": {
  "avgSentenceLength": 평균 문장 길이 (글자 수),
  ...
}
`;
```

**유저 프롬프트 업데이트** - 정확한 분석 요청:

```typescript
분석 시 주의사항:
1. 실제 글에 나타나는 내용만 분석하세요
2. 문장 수, 섹션 수, 글자 수를 정확하게 세세요
3. 구조 패턴을 실제 내용에서 확인하세요
```

---

### 3. Writer Agent Enhancement (`lib/agent/nodes/writer-agent.ts`)

**길이 제약 추가**:

```typescript
중요 - 길이 제약:
- 총 문장 수: ${styleProfile.lengthMetrics.totalSentences}개
- 섹션당 문장 수: ${styleProfile.lengthMetrics.sentencesPerSection}개
- 전체 글자 수: ${styleProfile.lengthMetrics.postLengthRange.min}-${max}자
- 너무 길게 쓰지 마세요. 참고 블로그의 길이를 정확히 따르세요.
```

**구조 제약 추가**:

```typescript
중요 - 구조 제약:
- 섹션 수: ${styleProfile.structureProfile.sectionCount}개
- 섹션 유형: ${styleProfile.structureProfile.sectionTypes.join(', ')}
- 도입부: ${hasIntroduction ? introLength + '문장' : '없음'}
- 마무리: ${hasConclusion ? conclusionLength + '문장' : '없음'}
```

**문장 구조 제약 추가**:

```typescript
중요 - 문장 구조:
- 평균 문장 길이: ${styleProfile.sentenceStructure.avgSentenceLength}자
- 자주 사용하는 접속사: ${commonConjunctions.join(', ')}
- 절 패턴: ${clausePatterns.join(', ')}
```

---

### 4. 수정 파일 목록

1. **`lib/types/style.ts`** - 새 인터페이스 추가
2. **`lib/agent/nodes/style-agent.ts`** - 분석 프롬프트 업데이트
3. **`lib/agent/nodes/writer-agent.ts`** - 제약 조건 추가

---

## 검증

1. **빌드**: `npm run build` - TypeScript 에러 없음 확인
2. **스타일 추출 테스트**: 새 필드가 정확히 추출되는지 확인
3. **길이 비교**: 생성된 글 길이 vs 참고 블로그 길이
4. **구조 비교**: 섹션 구조 일치 여부

---

## 구현 순서

1. **타입 정의** (`style.ts`) - 안전한 첫 단계
2. **스타일 에이전트** (`style-agent.ts`) - 분석 강화
3. **라이터 에이전트** (`writer-agent.ts`) - 제약 적용
4. **테스트 및 검증**
