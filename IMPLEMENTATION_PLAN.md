# Photo-to-Naver Blog Agent - Implementation Plan

## Context

사용자가 여행/맛집 사진을 업로드하면 AI가 기존 블로그 스타일을 분석하여 네이버 블로그에 자동으로 글을 발행하는 시스템을 구축한다.

**변경사항 (plan.md에서 수정):**
1. LLM: 현재 Claude Code 연결된 GLM 모델 사용
2. Style 입력: 블로그 글 20개 → 2개만 (HTML 크롤링으로 검색)
3. 백엔드: Next.js 단독 구조 (NestJS 제거)
4. 업로드: MVP에 포함 (Phase 5를 MVP로 통합)
5. 병렬 실행: Photo Agent와 Style Agent를 병렬로 실행

---

## Technical Stack (수정)

```text
Frontend + Backend: Next.js (App Router + API Routes)
Agent Framework: LangGraphJS
LLM: GLM (텍스트), Gemini (비전)
Automation: Playwright (네이버 블로그 업로드)
Language: TypeScript
```

---

## Project Structure (수정)

```text
src/
├── app/
│   ├── page.tsx              # 메인 페이지 (사진/블로그 URL 입력)
│   ├── api/
│   │   ├── generate/route.ts # 블로그 생성 API
│   │   └── naver/
│   │       ├── login/route.ts  # 네이버 로그인 API
│   │       └── upload/route.ts # 네이버 업로드 API
│
├── components/
│   ├── PhotoUploader.tsx
│   ├── BlogUrlInput.tsx
│   └── ResultViewer.tsx
│
├── lib/
│   ├── agent/
│   │   ├── graph.ts          # LangGraph 정의
│   │   ├── state.ts          # State 인터페이스
│   │   └── nodes/
│   │       ├── photo-agent.ts   # Gemini 이미지 분석
│   │       ├── style-agent.ts   # GLM 스타일 분석
│   │       ├── writer-agent.ts  # GLM 글 생성
│   │       └── reviewer-agent.ts # GLM 글 검토
│   │
│   ├── services/
│   │   ├── glm.service.ts      # GLM LLM 호출 (텍스트)
│   │   ├── gemini.service.ts   # Gemini 이미지 분석
│   │   ├── crawler.service.ts  # 네이버 블로그 크롤링
│   │   └── naver.service.ts    # Playwright 네이버 업로드
│   │
│   └── types/
│       ├── photo.ts
│       ├── style.ts
│       └── blog.ts
│
└── middleware.ts             # Playwright 헤드리스 서버용
```

---

## LangGraph State (수정)

```ts
export interface BlogState {
  // 입력
  images: UploadedImage[];
  blogUrls: string[];         // 네이버 블로그 URL 2개

  // 병렬 실행 결과
  photoAnalysis?: PhotoAnalysis;
  styleProfile?: StyleProfile;

  // 순차 실행 결과
  draft?: string;
  finalPost?: string;

  // 네이버 업로드 결과
  uploadResult?: {
    success: boolean;
    url?: string;
    error?: string;
  };
}
```

---

## Architecture (수정)

```text
┌─────────────────────────────────────────┐
│              Next.js App                │
│  ┌──────────────────────────────────┐   │
│  │     LangGraph (Parallel)         │   │
│  │                                  │   │
│  │  Photo Agent (Gemini) ───┐       │   │
│  │                           │       │   │
│  │  Style Agent (GLM) ─────┼──> Writer (GLM) ──> Reviewer (GLM)
│  │                           │       │   │
│  └───────────────────────────┼───────┴──> Naver Upload
│                              │
└──────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: 기본 프로젝트 설정 ✅

```bash
# Next.js 프로젝트 생성
npm create next-app@latest blog-generator -- --typescript --tailwind --app
cd blog-generator

# 의존성 설치
npm install @langchain/langgraph @langchain/core playwright cheerio @google/generative-ai
npx playwright install chromium
```

**산출물:**
- ✅ Next.js 프로젝트 구조
- ✅ TypeScript 설정
- ✅ Tailwind CSS 설정

---

### Phase 2: 네이버 블로그 크롤링 ✅

**목표:** 네이버 블로그 URL에서 글 내용 추출

```ts
// lib/services/crawler.service.ts
async fetchBlogPost(url: string): Promise<BlogPost>
```

**구현 내용:**
- ✅ cheerio로 HTML 파싱
- ✅ 네이버 블로그 구조에서 제목, 본문 추출
- ✅ 텍스트 클린징

---

### Phase 3: LLM 서비스 & LangGraph 노드 ✅

**목표:** LLM 호출과 에이전트 노드 구현

```ts
// lib/services/glm.service.ts
async callGLM(prompt: string): Promise<string> // 텍스트 모델 (GLM)

// lib/services/gemini.service.ts
async analyzeImages(images: Image[]): Promise<PhotoAnalysis> // 비전 모델 (Gemini)

// lib/agent/nodes/
- photo-agent.ts: 이미지 분석 (Gemini 2.5 Flash)
- style-agent.ts: 스타일 분석 (GLM-4.5)
- writer-agent.ts: 글 생성 (GLM-4.5)
- reviewer-agent.ts: 글 검토 (GLM-4.5)
```

---

### Phase 4: LangGraph 구축 (병렬 실행) ✅

**목표:** Photo + Style 병렬 → Writer → Reviewer

```ts
// lib/agent/graph.ts
// Photo와 Style를 Promise.all로 병렬 실행 후 그래프 실행
```

---

### Phase 5: 네이버 블로그 업로드 (Playwright) ✅

**목표:** 생성된 글을 네이버 블로그에 자동 발행

```ts
// lib/services/naver.service.ts
async uploadPost(post: FinalPost, options?: { imagePaths?: string[] }): Promise<UploadResult>
```

**구현 내용:**
1. ✅ 네이버 로그인 (수동 → 세션 저장)
2. ✅ 글쓰기 페이지 접근
3. ✅ 제목/본문/태그 입력
4. ✅ 발행 버튼 클릭
5. ✅ **이미지 업로드 기능 추가**

---

### Phase 6: UI 구현 ✅

**컴포넌트:**
- ✅ PhotoUploader: 이미지 업로드
- ✅ BlogUrlInput: 네이버 블로그 URL 2개 입력
- ✅ ResultViewer: 생성된 글 미리보기 + 네이버 업로드 버튼
- ✅ Login UI: 로그인 필요시 알림

---

## Key Files Created

1. ✅ `app/page.tsx` - 메인 페이지
2. ✅ `app/api/generate/route.ts` - 블로그 생성 API
3. ✅ `app/api/naver/login/route.ts` - 네이버 로그인 API
4. ✅ `app/api/naver/upload/route.ts` - 네이버 업로드 API
5. ✅ `lib/agent/graph.ts` - LangGraph 정의
6. ✅ `lib/agent/state.ts` - State 타입
7. ✅ `lib/agent/nodes/photo-agent.ts` - 사진 분석 노드 (Gemini)
8. ✅ `lib/agent/nodes/style-agent.ts` - 스타일 분석 노드 (GLM)
9. ✅ `lib/agent/nodes/writer-agent.ts` - 글 생성 노드 (GLM)
10. ✅ `lib/agent/nodes/reviewer-agent.ts` - 글 검토 노드 (GLM)
11. ✅ `lib/services/crawler.service.ts` - 네이버 크롤링
12. ✅ `lib/services/glm.service.ts` - GLM LLM 호출
13. ✅ `lib/services/gemini.service.ts` - Gemini 이미지 분석
14. ✅ `lib/services/naver.service.ts` - Playwright 네이버 업로드

---

## Environment Variables

```bash
# GLM API 설정 (텍스트 모델용)
GLM_API_KEY=your_glm_api_key_here
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_TEXT_MODEL=glm-4.5

# Gemini API 설정 (비전 모델용)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

---

## Verification

1. ✅ 크롤링 테스트: 네이버 블로그 URL에서 글이 제대로 추출되는지
2. ✅ 병렬 실행 테스트: Photo + Style Agent가 동시에 실행되는지
3. ✅ 글 생성 테스트: 스타일이 반영된 글이 생성되는지
4. ✅ 업로드 테스트: 네이버 블로그에 글이 발행되는지
5. ✅ 이미지 업로드: 업로드한 사진도 함께 업로드되는지

---

## Usage Flow

1. **이미지 업로드**: 여행/맛집 사진 업로드
2. **블로그 URL 입력**: 기존 블로그 글 2개의 URL 입력
3. **글 생성**: "블로그 글 생성" 버튼 클릭
   - Photo Agent (Gemini) → 이미지 분석
   - Style Agent (GLM) → 블로그 크롤링 + 스타일 분석
   - Writer Agent (GLM) → 글 생성
   - Reviewer Agent (GLM) → 글 검토
4. **네이버 로그인**: 최초 1회 수동 로그인 → 세션 저장
5. **발행**: "네이버 블로그에 발행하기" 클릭 → 자동 발행
