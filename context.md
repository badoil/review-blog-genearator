# Photo-to-Naver Blog Agent - Context

## 프로젝트 개요

사용자가 여행/맛집 사진을 업로드하면 AI가 기존 네이버 블로그 스타일을 분석하여 블로그 글을 자동으로 생성하고 네이버 블로그에 발행하는 시스템입니다.

---

## 기능

- 📸 **사진 분석**: Gemini 2.5 Flash로 업로드된 사진 분석 (장소, 활동, 음식, 분위기, 타임라인)
- 📝 **스타일 분석**: 네이버 블로그 크롤링으로 기존 글쓰기 스타일 분석 (말투, 이모지, 문단 길이, 자주 쓰는 표현 등)
- ✍️ **글 생성**: LangGraphJS로 사진 분석 + 스타일 반영한 블로그 글 생성
- 🖼️ **이미지 배치**: 생성된 글에 적절한 위치에 이미지 배치
- 🚀 **자동 발행**: Playwright로 네이버 블로그에 자동 업로드 (이미지 포함)

---

## 기술 스택

| 구분 | 기술 | 용도 |
|------|------|------|
| Frontend + Backend | Next.js (App Router + API Routes) | 전체 앱 |
| Agent Framework | LangGraphJS | 블로그 생성 파이프라인 |
| LLM (Text) | GLM-5.1 | 스타일 분석, 글 생성, 글 검토 |
| LLM (Vision) | Gemini 2.5 Flash | 이미지 분석 |
| Automation | Playwright | 네이버 블로그 자동화 |
| Crawling | Cheerio | 네이버 블로그 HTML 파싱 |
| Language | TypeScript | 전체 코드 |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App (Single Page)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              LangGraph Execution Flow                 │   │
│  │                                                        │   │
│  │   ┌──────────────┐                                   │   │
│  │   │ Photo Agent  │ (Gemini)                          │   │
│  │   │ 이미지 분석  │ category, mainItem 추출            │   │
│  │   └──────┬───────┘                                   │   │
│  │          │                                            │   │
│  │   ┌──────▼────────┐                                   │   │
│  │   │ Style Agent   │ (GLM)                            │   │
│  │   │ 스타일 분석    │                                   │   │
│  │   │ + 크롤링       │                                   │   │
│  │   └──────┬─────────┘                                  │   │
│  │          │ ▼ (병렬 실행 → Promise.all)               │   │
│  │   ┌──────┴──────────────────┐                        │   │
│  │   │ Grouping Node            │                        │   │
│  │   │ mainItem 기반 그룹핑       │                        │   │
│  │   │ (1-3장씩 자연스럽게)      │                        │   │
│  │   └──────┬───────────────────┘                        │   │
│  │          │                                            │   │
│  │   ┌──────▼────────┐                                   │   │
│  │   │ Writer Agent │ (GLM)                            │   │
│  │   │ 그룹별 텍스트 생성                                │   │
│  │   │ (그룹 1개당 섹션 1개)     │                        │   │
│  │   └──────┬─────────┘                                  │   │
│  │          │                                            │   │
│  │   ┌──────▼────────┐                                   │   │
│  │   │ Reviewer     │ (GLM)                            │   │
│  │   │ 글 검토/다듬기 │                                   │   │
│  │   └──────┬─────────┘                                  │   │
│  │          │                                            │   │
│  │   ┌──────▼────────┐                                   │   │
│  │   │ Final Output  │                                   │   │
│  │   │ (finalPost)   │                                   │   │
│  │   └───────────────┘                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Naver Upload (Playwright)                    │   │
│  │   - 로그인 세션 유지 (naver-session.json)             │   │
│  │   - 글 작성 + 이미지 업로드                           │   │
│  │   - 발행                                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                    # 메인 페이지 (단일 페이지 UI)
│   ├── layout.tsx                  # 레이아웃
│   ├── globals.css                 # 전역 스타일
│   └── api/
│       ├── generate/route.ts       # 블로그 생성 API
│       └── naver/
│           ├── login/route.ts      # 네이버 로그인 API
│           ├── logout/route.ts     # 네이버 로그아웃 API
│           ├── status/route.ts     # 로그인 상태 확인 API
│           └── upload/route.ts    # 네이버 업로드 API
│
├── lib/
│   ├── agent/
│   │   ├── graph.ts                # LangGraph 정의 및 실행
│   │   ├── state.ts                # State 인터페이스
│   │   └── nodes/
│   │       ├── photo-agent.ts      # 사진 분석 노드 (Gemini)
│   │       ├── style-agent.ts      # 스타일 분석 노드 (GLM)
│   │       ├── grouping-node.ts     # 사진 그룹핑 노드 (GLM)
│   │       ├── writer-agent.ts     # 글 생성 노드 (GLM)
│   │       └── reviewer-agent.ts   # 글 검토 노드 (GLM)
│   │
│   ├── services/
│   │   ├── glm.service.ts          # GLM LLM 호출
│   │   ├── gemini.service.ts       # Gemini 이미지 분석
│   │   ├── crawler.service.ts      # 네이버 블로그 크롤링
│   │   └── naver.service.ts        # Playwright 네이버 업로드
│   │
│   └── types/
│       ├── photo.ts                # 이미지 관련 타입
│       ├── style.ts                # 스타일 관련 타입
│       └── blog.ts                 # 블로그 관련 타입
│
├── public/                          # 정적 파일
├── .env.local                       # 환경 변수 (gitignore)
├── naver-session.json              # 네이버 로그인 세션 (gitignore)
└── package.json
```

---

## LangGraph State

```ts
export interface BlogState {
  // 입력
  images: UploadedImage[];
  blogUrls: string[];
  naverBlogId?: string;

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

  // 네이버 업로드 결과
  uploadResult?: UploadResult;
  publishedUrl?: string;

  // 에러 처리
  error?: string;
}
```

---

## 타입 정의

### PhotoAnalysis (lib/types/photo.ts)

```ts
export interface UploadedImage {
  path: string;
  filename: string;
  buffer?: Buffer;
  base64?: string;
}

export interface ImageAnalysis {
  index: number;           // 이미지 순서
  description: string;      // 이미지 전체 설명
  places: string[];         // 식별된 장소
  activities: string[];     // 식별된 활동
  foods: string[];          // 식별된 음식
  time?: string;            // 추정 시간대
  location?: string;        // 구체적 장소 이름
  category?: 'food' | 'activity' | 'place' | 'transport' | 'other';  // 카테고리
  mainItem?: string;        // 그룹핑용 단일 키 (예: 타코야끄, 산책, 카페)
}

export interface PhotoAnalysis {
  images: ImageAnalysis[];  // 각 이미지별 분석
  places: string[];          // 전체 장소 (중복 제거)
  activities: string[];      // 전체 활동 (중복 제거)
  foods: string[];           // 전체 음식 (중복 제거)
  mood: string;              // 전체 분위기
  timeline: TimelineItem[]; // 동선 요약
}

export interface TimelineItem {
  time?: string;
  location?: string;
  activity?: string;
}

// Photo Grouping 타입
export interface PhotoGroup {
  id: string;                    // 그룹 ID (group-1, group-2...)
  title: string;                 // 그룹 제목
  description: string;           // 그룹 설명
  imageIndices: number[];        // 포함된 이미지 인덱스
  category: string;              // 카테고리
  mainItem: string;              // 그룹핑 키
  time?: string;                 // 시간대
  location?: string;             // 장소
}

export interface PhotoGroupingResult {
  groups: PhotoGroup[];          // 그룹 목록 (업로드 순서 유지)
}

export interface ImagePlacement {
  imageIndex: number;
  position: 'before' | 'after' | 'replace';
  sectionTitle?: string;        // 섹션 제목 (예: "섹션 1")
  groupImageIndices?: number[]; // 그룹에 속한 모든 이미지 인덱스
  targetText?: string;
  insertIndex?: number;
}
```

### StyleProfile (lib/types/style.ts)

```ts
export interface StyleProfile {
  tone: string;
  endingPattern: string;
  emojiLevel: number;           // 0-3
  paragraphLength: 'short' | 'medium' | 'long';
  writingStyle: string;

  // 심층 분석 필드
  commonPhrases?: string[];      // 자주 사용하는 표현
  sentenceStyle?: string;        // 문장 스타일
  punctuation?: string;          // 문장 부호 사용 습관
}
```

### Blog Types (lib/types/blog.ts)

```ts
export interface BlogPost {
  title: string;
  content: string;
  url: string;
  author?: string;
  date?: string;
}

export interface FinalPost {
  title: string;
  content: string;
  tags: string[];
}

export interface NaverCredentials {
  id: string;
  password: string;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}
```

---

## LangGraph 노드

### 1. Photo Agent (photo-agent.ts)

**역할**: 업로드된 이미지 분석

**모델**: Gemini 2.5 Flash

**출력**:
- `photoAnalysis`: 장소, 활동, 음식, 분위기, 타임라인
- 각 이미지별 `category`, `mainItem` 추출 (그룹핑용)

---

### 2. Style Agent (style-agent.ts)

**역할**: 네이버 블로그 글 크롤링 + 스타일 분석

**모델**: GLM-5.1

**출력**:
- `styleProfile`: 말투, 이모지 레벨, 문단 길이, 자주 쓰는 표현 등
- `referencePosts`: 원본 블로그 내용

---

### 3. Grouping Node (grouping-node.ts)

**역할**: mainItem 기반 이미지 그룹핑

**모델**: GLM-5.1 (동일 mainItem이 2장 이상일 때만)

**로직**:
1. 업로드 순서대로 같은 mainItem끼리 1차 그룹화
2. 같은 mainItem이 2장 이상이면 LLM으로 description 분석 후 세부 그룹핑
3. 최종 그룹 크기는 1-3장

**출력**:
- `photoGrouping`: 그룹 목록

---

### 4. Writer Agent (writer-agent.ts)

**역할**: 그룹별 텍스트 생성 + 이미지 배치

**모델**: GLM-5.1

**로직**:
- `photoGrouping`이 있으면: 그룹별로 텍스트 생성 (그룹 1개당 섹션 1개)
- `photoGrouping`이 없으면: 이미지별 섹션 생성 (기존 방식)

**출력**:
- `draft`: 초안
- `imagePlacements`: 이미지 배치 정보

---

### 5. Reviewer Agent (reviewer-agent.ts)

**역할**: 생성된 글을 자연스럽게 다듬기

**모델**: GLM-5.1

**출력**:
- `finalPost`: 최종 글

---

## 병렬 실행 구현

Photo Agent와 Style Agent는 병렬로 실행됩니다:

```ts
// graph.ts
const [photoResult, styleResult] = await Promise.all([
  photoNode(state).then(result => ({ ...result, nodeName: 'photo' })),
  styleNode(state).then(result => ({ ...result, nodeName: 'style' })),
]);
```

이후 순차적으로 Grouping → Writer → Reviewer가 실행됩니다.

---

## API Routes

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/generate` | POST | 블로그 글 생성 |
| `/api/naver/login` | POST | 네이버 로그인 (헤드리스 모드) |
| `/api/naver/logout` | POST | 네이버 로그아웃 (세션 삭제) |
| `/api/naver/status` | GET | 로그인 상태 확인 |
| `/api/naver/upload` | POST | 네이버 블로그 발행 (이미지 포함) |

---

## 환경 변수

```bash
# GLM API 설정 (텍스트 모델)
GLM_API_KEY=your_glm_api_key_here
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_TEXT_MODEL=glm-5.1

# Gemini API 설정 (비전 모델)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

---

## 네이버 세션 관리

- 세션 파일: `naver-session.json`
- 최초 1회 수동 로그인 필요
- 이후 세션 파일로 자동 로그인
- 로그아웃 시 세션 파일 삭제

---

## 사용 흐름

1. **이미지 업로드**: 여행/맛집 사진 업로드
2. **블로그 URL 입력**: 기존 블로그 글 2개의 URL 입력 (스타일 분석용)
3. **블로그 글 생성**:
   - Photo Agent (Gemini) → 이미지 분석 (category, mainItem 추출)
   - Style Agent (GLM) → 블로그 크롤링 + 스타일 분석 (병렬 실행)
   - Grouping Node (GLM) → mainItem 기반 그룹핑
   - Writer Agent (GLM) → 그룹별 텍스트 생성 + 이미지 배치
   - Reviewer Agent (GLM) → 글 검토
4. **네이버 로그인**: 최초 1회 수동 로그인 → 세션 저장
5. **네이버 발행**: "네이버 블로그에 발행하기" 클릭 → 자동 발행

---

## UI 구현

단일 페이지 앱 (`app/page.tsx`)으로 구현:

- 블로그 URL 입력 (2개)
- 이미지 업로드 (다중)
- 로그인/로그아웃 버튼
- 생성된 글 미리보기
- 이미지 미리보기
- 네이버 발행 버튼

---

## 검증 상태

✅ Phase 1: 기본 프로젝트 설정
✅ Phase 2: 네이버 블로그 크롤링
✅ Phase 3: LLM 서비스 & LangGraph 노드
✅ Phase 4: LangGraph 구축 (병렬 실행)
✅ Phase 5: 네이버 블로그 업로드 (Playwright + 이미지)
✅ Phase 6: UI 구현
✅ Phase X: Photo Grouping 구현
   - category, mainItem 추출 (Photo Agent)
   - Grouping Node 추가 (규칙 기반 그룹핑)
   - Writer Agent 수정 (그룹별 텍스트 생성)
   - Graph 구조 변경 (Photo+Style → Grouping → Writer → Reviewer)

---

## 카테고리 기반 사진 정렬 (2026-07-06)

### 목적

사진을 업로드 순서와 상관없이 지정된 카테고리 순서대로 블로그 글에 배치합니다.

### 카테고리 순서

1. **외관** - 건물 외관, 간판/입구
2. **내부** - 실내 내부, 인테리어, 야외 좌석
3. **메뉴판** - 메뉴판 사진
4. **음식** - 테이블 위 음식 (전체)
5. **디테일 컷** - 음식 디테일/클로즈업

### 구현

**1. PhotoDisplayCategory 타입 (`lib/types/photo.ts`)**

```ts
export enum PhotoDisplayCategory {
  EXTERIOR = 'exterior',      // 외관
  INTERIOR = 'interior',      // 내부
  MENU = 'menu',              // 메뉴판
  FOOD = 'food',              // 음식 (전체)
  DETAIL = 'detail'           // 디테일 컷 (음식 클로즈업)
}

export const CATEGORY_ORDER: PhotoDisplayCategory[] = [
  PhotoDisplayCategory.EXTERIOR,
  PhotoDisplayCategory.INTERIOR,
  PhotoDisplayCategory.MENU,
  PhotoDisplayCategory.FOOD,
  PhotoDisplayCategory.DETAIL
];
```

**2. Category Mapper (`lib/utils/category-mapper.ts`)**

- `mapToDisplayCategory()`: scene/view/focus 값을 카테고리로 매핑
- `sortImagesByCategory()`: 이미지를 카테고리 순서로 정렬

**3. Photo Agent 수정 (`lib/agent/nodes/photo-agent.ts`)**

- 사진 분석 후 `sortImagesByCategory()` 호출로 이미지 재배열
- `sortedImageOrder`를 반환하여 원래 순서 정보 전달

**4. API Route 수정 (`app/api/generate/route.ts`)**

- `sortedImageOrder`를 사용하여 `imageObjects`를 재배열
- 텍스트와 이미지가 같은 순서로 나오도록 동기화

### 작동 방식

1. Photo Agent가 사진 분석 완료
2. `sortImagesByCategory()`가 이미지를 5개 카테고리 순서로 재배열
3. 재배열된 순서대로 `index` 필드 업데이트
4. `sortedImageOrder`를 반환 (원래 인덱스 매핑)
5. `route.ts`에서 `sortedImageOrder`를 사용하여 `imageObjects`를 재배열
6. Writer Agent는 정렬된 순서대로 글 생성
7. 텍스트와 이미지가 카테고리 순서대로 일치하여 나옴

### Scene/View/Focus 매핑 규칙

| 카테고리 | Scene | View | Focus |
|---------|-------|------|-------|
| MENU | "메뉴판", "간판" | (any) | "간판" |
| EXTERIOR | "건물 외관", "입구", "파사드" | 전경, 중거리 | "건물", "간판" |
| INTERIOR | "실내 내부", "인테리어", "야외 좌석", "주방" | (any) | "파라솔", "정원" |
| FOOD | "테이블 위 음식" | 전경, 중거리 | "음식" |
| DETAIL | (any) | "클로즈업" | "음식" |

### 로그 확인

```
[Photo Agent] 정렬 전 순서: 1. 음식 (idx:0), 2. 내부 (idx:1)...
[Photo Agent] 정렬 후 순서: 1. 외관 (originalIdx:2), 2. 내부 (originalIdx:1)...
[Photo Agent] sortedImageOrder: [2, 1, 3, 0, 4]
[API] imageObjects 재배열 완료
```

---

## 섹션 패턴 유지 수정 (2026-07-02)

### 문제

Reviewer Agent가 글을 다듬는 과정에서 "섹션 1:", "섹션 2:" 패턴을 제거하여 이미지가 배치되지 않는 문제가 발생했습니다.

### 해결

`lib/agent/nodes/reviewer-agent.ts`에 섹션 패턴 유지 지시를 추가했습니다.

**시스템 프롬프트 추가:**
```
**매우 중요: 섹션 패턴 유지**
- "섹션 1:", "섹션 2:" 같은 섹션 구분 패턴은 **절대 제거하지 마세요**
- 섹션 패턴은 그대로 유지하면서 내용만 다듬어주세요
- 이 패턴은 이미지를 자동으로 배치하는 데 사용됩니다
```

**사용자 프롬프트 추가:**
```
**중요: "섹션 N:" 패턴은 반드시 유지해주세요. 이 패턴을 제거하거나 변경하지 마세요!**
```


## Langfuse 연동 (진행중)

LangGraphJS는 Langfuse와 호환됩니다. 연동을 통해 추적 및 모니터링이 가능합니다.
**Langfuse는 오픈소스로, 무료 티어가 관대하고 셀프 호스팅도 가능합니다.**

### 목표

1. **가시성**: 각 노드와 LLM 호출의 실행 내용 추적
2. **디버깅**: 문제 발생 시 원인 파악 용이성
3. **평가**: 생성된 블로그 품질 측정
4. **최적화**: 비용 및 레이턴시 추적

---

### Phase 1: 패키지 설치 및 환경 변수 설정

**패키지 설치:**
```bash
npm install @langfuse/langfuse
```

**환경 변수 추가 (`.env.local`):**
```bash
LANGFUSE_PUBLIC_KEY=your_public_key
LANGFUSE_SECRET_KEY=your_secret_key
LANGFUSE_HOST=https://cloud.langfuse.com  # 또는 셀프 호스팅 URL
LANGFUSE_PROJECT=blog-generator
```

**Langfuse 키 발급:** https://cloud.langfuse.com (또는 셀프 호스팅 대시보드)

---

### Phase 2: LangGraph에 Tracing 설정 ✅

**목표**: Langfuse 대시보드에서 LangGraph 실행을 시각화

**완료:** `lib/agent/graph.ts`에 LangfuseCallbackHandler 적용

**변경 파일:** `lib/agent/graph.ts`

Langfuse는 LangChain의 Callback Handler 방식으로 통합됩니다:

```ts
import { LangfuseCallbackHandler } from '@langfuse/langfuse';

// 그래프 실행 시 callback 추가
export async function generateBlogPost(...) {
  const langfuse = new LangfuseCallbackHandler();

  const graph = createBlogGraph();
  const result = await graph.invoke(state, {
    callbacks: [langfuse],
  });

  return result;
}
```

---

### Phase 3: 병렬 실행 Tracing

**현재 문제점:** Photo/Style 병렬 실행이 `Promise.all`로 그래프 밖에서 수동 구현됨

```ts
// 현재 graph.ts - 그래프 밖에서 병렬 실행
const [photoResult, styleResult] = await Promise.all([
  photoNode(state),
  styleNode(state),
]);
```

**해결 방법:** 병렬 실행을 그래프 내부로 이동하여 Langfuse가 추적할 수 있도록 수정

**옵션 A - 그래프 노드로 추가:**
```ts
const graph = new StateGraph(StateAnnotation)
  .addNode('photo', photoNode)      // 그래프 내부 추가
  .addNode('style', styleNode)      // 그래프 내부 추가
  .addNode('grouping', groupingNode)
  .addNode('writer', writerNode)
  .addNode('reviewer', reviewerNode);

// START → photo, style (병렬)
graph.addEdge(START, 'photo');
graph.addEdge(START, 'style');

// photo, style → grouping (합류)
graph.addEdge('photo', 'grouping');
graph.addEdge('style', 'grouping');
```

---

### Phase 4: LLM 서비스에 메타데이터 추가 (선택)

**목표:** 각 LLM 호출에 의미 있는 태그 추가

**변경 파일:** `lib/services/glm.service.ts`, `lib/services/gemini.service.ts`

**구현 예시:**
```ts
// 노드 이름과 태그를 trace에 포함
const metadata = {
  node: 'writer-agent',
  groupId: group.id,
  imageCount: group.imageIndices.length,
};
```

---

### Phase 5: Evaluation 설정 (선택, 고급)

Langfuse는 빌트인 평가 기능을 제공합니다:

**평가 항목:**
- **Style Consistency**: 스타일 프로필과 생성된 글의 일치성
- **Image-Text Alignment**: 이미지 분석과 텍스트의 일치성
- **Coherence**: 글의 논리적 흐름
- **Length**: 적절한 길이

---

### Phase 6: 셀프 호스팅 (선택)

Docker로 Langfuse 직접 호스팅 가능:

```bash
git clone https://github.com/langfuse/langfuse
cd langfuse
docker-compose up
```

---

### 구현 순서

1. **Phase 1**: 패키지 설치 + 환경 변수 설정
2. **Phase 2**: LangGraph에 callback 추가
3. **Phase 3**: 병렬 실행 tracing (구조 변경 필요)
4. **Phase 4**: 메타데이터 추가 (선택)
5. **Phase 5**: Evaluation 구현 (고급, 나중에)
6. **Phase 6**: 셀프 호스팅 (필요시)

---

### 검증 방법

1. Langfuse 대시보드 접속: https://cloud.langfuse.com (또는 셀프 호스팅 URL)
2. 프로젝트 선택: `blog-generator`
3. 블로그 생성 실행
4. Trace 확인:
   - 전체 실행 시간
   - 각 노드별 실행 시간
   - LLM 호출별 입력/출력
   - 토큰 사용량

---

### 참고 링크

- Langfuse 문서: https://langfuse.com/docs
- LangGraph + Langfuse: https://langfuse.com/docs/integrations/langchain/langgraph
- Langfuse GitHub: https://github.com/langfuse/langfuse
