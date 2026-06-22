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
│  │   │ 이미지 분석  │                                   │   │
│  │   └──────┬───────┘                                   │   │
│  │          │                                            │   │
│  │   ┌──────▼────────┐                                   │   │
│  │   │ Style Agent   │ (GLM)                            │   │
│  │   │ 스타일 분석    │                                   │   │
│  │   │ + 크롤링       │                                   │   │
│  │   └──────┬─────────┘                                  │   │
│  │          │ ▼ (병렬 실행 → Promise.all)               │   │
│  │   ┌──────┴──────────────────┐                        │   │
│  │   │ Writer Agent             │                        │   │
│  │   │ 글 생성 + 이미지 배치      │                        │   │
│  │   └──────┬───────────────────┘                        │   │
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

  // 병렬 실행 결과
  photoAnalysis?: PhotoAnalysis;
  styleProfile?: StyleProfile;

  // 참고 블로그 내용 (리뷰어에서 비교용)
  referencePosts?: string;

  // 순차 실행 결과
  draft?: string;
  finalPost?: string;
  imagePlacements?: ImagePlacement[];  // 이미지 배치 정보

  // 네이버 업로드 결과
  uploadResult?: UploadResult;

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

export interface ImagePlacement {
  imageIndex: number;
  position: 'before' | 'after' | 'replace';
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

---

### 2. Style Agent (style-agent.ts)

**역할**: 네이버 블로그 글 크롤링 + 스타일 분석

**모델**: GLM-5.1

**출력**:
- `styleProfile`: 말투, 이모지 레벨, 문단 길이, 자주 쓰는 표현 등
- `referencePosts`: 원본 블로그 내용

---

### 3. Writer Agent (writer-agent.ts)

**역할**: 사진 분석 + 스타일로 글 생성 + 이미지 배치

**모델**: GLM-5.1

**출력**:
- `draft`: 초안
- `imagePlacements`: 이미지 배치 정보

---

### 4. Reviewer Agent (reviewer-agent.ts)

**역할**: 생성된 글을 자연스럽게 다듬기

**모델**: GLM-5.1

**출력**:
- `finalPost`: 최종 글

---

## 병렬 실행 구현

```ts
// graph.ts
const [photoResult, styleResult] = await Promise.all([
  photoNode(state).then(result => ({ ...result, nodeName: 'photo' })),
  styleNode(state).then(result => ({ ...result, nodeName: 'style' })),
]);
```

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
   - Photo Agent (Gemini) → 이미지 분석
   - Style Agent (GLM) → 블로그 크롤링 + 스타일 분석 (병렬 실행)
   - Writer Agent (GLM) → 글 생성 + 이미지 배치
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
