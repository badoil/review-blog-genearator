# Photo-to-Naver Blog Agent

## 프로젝트 개요

### 프로젝트명

Photo-to-Naver Blog Agent

### 목표

사용자가 여러 장의 사진을 업로드하면 다음 과정을 자동 수행하는 AI Agent를 개발한다.

* 사진 분석
* 기존 블로그 스타일 분석
* 블로그 글 생성
* 이미지 배치
* 네이버 블로그 업로드

---

## 기능

- 📸 **사진 분석**: Gemini 2.5 Flash로 업로드된 사진 분석 (장소, 활동, 음식, 분위기, 타임라인)
- 📝 **스타일 분석**: 네이버 블로그 크롤링으로 기존 글쓰기 스타일 분석
- ✍️ **글 생성**: LangGraphJS로 사진 + 스타일 반영한 블로그 글 생성
- 🖼️ **이미지 배치**: 생성된 글에 적절한 위치에 이미지 배치
- 🚀 **자동 발행**: Playwright로 네이버 블로그에 자동 업로드

---

## 사용자 시나리오

### 여행 후기 작성

사용자

```text
제주도 여행 사진 30장 업로드
```

시스템

```text
사진 분석

↓

장소 및 활동 추론

↓

사용자 블로그 스타일 분석 (URL 2개)

↓

블로그 글 생성

↓

이미지 배치

↓

네이버 블로그 발행
```

결과

```text
제목

본문

이미지 배치

태그
```

---

### 맛집 후기 작성

사용자

```text
음식 사진
매장 사진
메뉴판 사진
```

업로드

시스템

```text
음식 분석

분위기 분석

후기 생성
```

---

## 기술 스택

### Frontend + Backend

* Next.js (App Router + API Routes)
* React
* TypeScript
* Tailwind CSS

### Agent Framework

* LangGraphJS
* LangChain

### LLM

* GLM-5.1 (텍스트: 스타일 분석, 글 생성, 글 검토)
* Gemini 2.5 Flash (비전: 이미지 분석)

### Automation

* Playwright (네이버 블로그 업로드)

### Crawling

* Cheerio (네이버 블로그 HTML 파싱)

구조

```text
LangGraph
    ↓
GLM (Text) / Gemini (Vision)
    ↓
Playwright (Naver Upload)
```

---

## 시스템 아키텍처

```text
┌────────────────────┐
│      Next.js       │
│   (Single Page)    │
└─────────┬──────────┘
          │
          ▼

┌────────────────────┐
│   LangGraphJS      │
└─────────┬──────────┘
          │

 ┌────────┼────────┐

 ▼                 ▼

Photo Agent    Style Agent
(Gemini)        (GLM + Crawling)

        ▼

      Writer (GLM)
      (이미지 배치 포함)

        ▼

     Reviewer (GLM)

        ▼

      Result
```

---

## Agent 설계

### 1. Photo Analyzer Agent

### 역할

업로드된 사진을 분석한다.

### 입력

```ts
images[]
```

### 출력

```json
{
  "images": [{
    "index": 0,
    "description": "...",
    "places": [],
    "activities": [],
    "foods": [],
    "time": "...",
    "location": "..."
  }],
  "places": [],
  "activities": [],
  "foods": [],
  "mood": "",
  "timeline": []
}
```

### 예시

```json
{
  "places": ["협재해수욕장"],
  "activities": ["서핑"],
  "foods": ["흑돼지"],
  "mood": "여유로움",
  "timeline": [
    {"time": "아침", "location": "협재해수욕장", "activity": "서핑"}
  ]
}
```

---

### 2. Style Analyzer Agent

### 역할

사용자의 기존 네이버 블로그 글을 크롤링하여 분석한다.

### 입력

```ts
blogUrls[]  // 네이버 블로그 URL 2개
```

### 출력

```json
{
  "tone": "",
  "endingPattern": "",
  "emojiLevel": 0,
  "paragraphLength": "short",
  "writingStyle": "",
  "commonPhrases": [],
  "sentenceStyle": "",
  "punctuation": ""
}
```

### 예시

```json
{
  "tone": "친근함",
  "endingPattern": "~했어요",
  "emojiLevel": 2,
  "paragraphLength": "short",
  "commonPhrases": ["완전 추천", "대박"]
}
```

---

### 3. Writer Agent

### 역할

사진 분석 결과와 스타일 프로필을 이용해 블로그 초안을 생성한다.

### 입력

```json
{
  "photoAnalysis": {},
  "styleProfile": {}
}
```

### 출력

```text
블로그 초안
이미지 배치 정보
```

### 생성 항목

* 제목
* 도입부
* 본문
* 마무리
* 태그
* 이미지 배치 위치

---

### 4. Reviewer Agent

### 역할

생성된 글을 검토한다.

### 검토 항목

* 반복 표현 제거
* AI 느낌 감소
* 문장 자연스러움 개선
* 문맥 보정

### 출력

```text
최종 원고
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
  imagePlacements?: ImagePlacement[];

  // 네이버 업로드 결과
  uploadResult?: UploadResult;

  // 에러 처리
  error?: string;
}
```

---

## 타입 정의

### PhotoAnalysis

```ts
export interface PhotoAnalysis {
  images: ImageAnalysis[];
  places: string[];
  activities: string[];
  foods: string[];
  mood: string;
  timeline: TimelineItem[];
}

export interface ImageAnalysis {
  index: number;
  description: string;
  places: string[];
  activities: string[];
  foods: string[];
  time?: string;
  location?: string;
}

export interface TimelineItem {
  time?: string;
  location?: string;
  activity?: string;
}
```

### StyleProfile

```ts
export interface StyleProfile {
  tone: string;
  endingPattern: string;
  emojiLevel: number;
  paragraphLength: 'short' | 'medium' | 'long';
  writingStyle: string;
  commonPhrases?: string[];
  sentenceStyle?: string;
  punctuation?: string;
}
```

### ImagePlacement

```ts
export interface ImagePlacement {
  imageIndex: number;
  position: 'before' | 'after' | 'replace';
  targetText?: string;
  insertIndex?: number;
}
```

---

## 프로젝트 구조

```text
src/

├── app/
│   ├── page.tsx              # 메인 페이지 (단일 페이지 UI)
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── generate/route.ts # 블로그 생성 API
│       └── naver/
│           ├── login/route.ts
│           ├── logout/route.ts
│           ├── status/route.ts
│           └── upload/route.ts
│
├── lib/
│   ├── agent/
│   │   ├── graph.ts
│   │   ├── state.ts
│   │   └── nodes/
│   │       ├── photo-agent.ts
│   │       ├── style-agent.ts
│   │       ├── writer-agent.ts
│   │       └── reviewer-agent.ts
│   │
│   ├── services/
│   │   ├── glm.service.ts
│   │   ├── gemini.service.ts
│   │   ├── crawler.service.ts
│   │   └── naver.service.ts
│   │
│   └── types/
│       ├── photo.ts
│       ├── style.ts
│       └── blog.ts
│
├── public/
├── naver-session.json
└── package.json
```

---

## 개발 단계

### Phase 1 - 기본 프로젝트 설정 ✅

목표

```text
Next.js 프로젝트 생성
```

산출물

* ✅ Next.js 프로젝트 구조
* ✅ TypeScript 설정
* ✅ Tailwind CSS 설정

---

### Phase 2 - 네이버 블로그 크롤링 ✅

목표

```text
블로그 URL 2개 입력

↓

글 내용 추출
```

산출물

* ✅ crawler.service.ts (Cheerio)
* ✅ 네이버 블로그 HTML 파싱
* ✅ 텍스트 클린징

---

### Phase 3 - LLM 서비스 & LangGraph 노드 ✅

목표

```text
LLM 호출 구현
에이전트 노드 구현
```

산출물

* ✅ glm.service.ts (GLM-5.1)
* ✅ gemini.service.ts (Gemini 2.5 Flash)
* ✅ photo-agent.ts
* ✅ style-agent.ts
* ✅ writer-agent.ts
* ✅ reviewer-agent.ts

---

### Phase 4 - LangGraph 구축 ✅

목표

```text
Photo Agent (병렬)

Style Agent (병렬)

↓

Writer Agent

↓

Reviewer Agent
```

산출물

* ✅ graph.ts (Promise.all 병렬 실행)
* ✅ state.ts

---

### Phase 5 - 네이버 블로그 업로드 ✅

목표

```text
로그인

↓

글 작성

↓

이미지 업로드

↓

발행
```

산출물

* ✅ naver.service.ts (Playwright)
* ✅ 세션 관리 (naver-session.json)
* ✅ 이미지 업로드

---

### Phase 6 - UI 구현 ✅

산출물

* ✅ app/page.tsx (단일 페이지)
* ✅ 블로그 URL 입력
* ✅ 이미지 업로드
* ✅ 생성 결과 표시
* ✅ 네이버 발행 버튼
* ✅ 로그인/로그아웃

---

## 성공 기준

사용자가

```text
사진 20~50장 업로드
```

하고

```text
네이버 블로그 URL 2개 제공
```

했을 때

10분 이내에

* 제목 생성
* 본문 생성
* 이미지 배치
* 태그 생성
* 네이버 블로그 발행

이 완료되고,

결과물이 사용자의 기존 글 스타일과 유사하다고 느껴지는 수준에 도달한다.

---

## 향후 확장 계획

## V2

* EXIF GPS 분석
* 여행 동선 자동 생성
* 장소 정보 자동 검색

## V3

* 예약 발행
* 다중 이미지 배치 옵션

## V4

* 여행 특화 템플릿
* 맛집 특화 템플릿
* 캠핑 특화 템플릿

## V5

* 다중 블로그 지원
* 콘텐츠 재생성
* SEO 최적화
* 썸네일 자동 생성
* SNS 동시 발행
