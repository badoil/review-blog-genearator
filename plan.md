# Photo-to-Naver Blog Agent

## 프로젝트 개요

### 프로젝트명

Photo-to-Naver Blog Agent

### 목표

사용자가 여러 장의 사진을 업로드하면 다음 과정을 자동 수행하는 AI Agent를 개발한다.

* 사진 분석
* 기존 블로그 스타일 분석
* 블로그 글 생성
* 네이버 블로그 업로드

초기 버전은 SaaS가 아닌 로컬 실행 환경을 목표로 한다.

---

# MVP 목표

최종 목표는 네이버 블로그 자동 업로드지만, 첫 번째 목표는 아래 기능을 성공시키는 것이다.

```text
사진 업로드

+

기존 블로그 글 분석

↓

사용자 스타일 반영

↓

블로그 글 생성
```

업로드 기능은 이후 단계에서 추가한다.

---

# 사용자 시나리오

## 여행 후기 작성

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

사용자 블로그 스타일 분석

↓

블로그 글 생성
```

결과

```text
제목

본문

태그
```

---

## 맛집 후기 작성

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

# 기술 스택

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

## Backend

* NestJS
* TypeScript

## Agent Framework

* LangGraphJS
* LangChain

## LLM

* GLM-4.5
* GLM-4.5V

## LLM Gateway

* LiteLLM

구조

```text
LangGraph
    ↓
LiteLLM
    ↓
GLM API
```

---

# 제외 범위

MVP에서는 아래 항목을 사용하지 않는다.

* PostgreSQL
* Redis
* BullMQ
* S3
* LangSmith
* Docker
* Kubernetes
* Cloud 배포

모든 기능은 로컬 환경에서 실행한다.

---

# 시스템 아키텍처

```text
┌────────────────────┐
│      Next.js       │
└─────────┬──────────┘
          │
          ▼

┌────────────────────┐
│      NestJS        │
└─────────┬──────────┘
          │
          ▼

┌────────────────────┐
│    LangGraphJS     │
└─────────┬──────────┘
          │

 ┌────────┼────────┐

 ▼                 ▼

Photo Agent    Style Agent

        ▼

      Writer

        ▼

     Reviewer

        ▼

      Result
```

---

# Agent 설계

## 1. Photo Analyzer Agent

### 역할

업로드된 사진을 분석한다.

### 입력

```ts
images[]
```

### 출력

```json
{
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
  "mood": "여유로움"
}
```

---

## 2. Style Analyzer Agent

### 역할

사용자의 기존 블로그 글을 분석한다.

### 입력

```ts
blogPosts[]
```

### 출력

```json
{
  "tone": "",
  "endingPattern": "",
  "emojiLevel": 0,
  "paragraphLength": "",
  "writingStyle": ""
}
```

### 예시

```json
{
  "tone": "친근함",
  "endingPattern": "~했어요",
  "emojiLevel": 2,
  "paragraphLength": "short"
}
```

---

## 3. Writer Agent

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
```

### 생성 항목

* 제목
* 도입부
* 본문
* 마무리
* 태그

---

## 4. Reviewer Agent

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

# LangGraph State

```ts
export interface BlogState {
  images: UploadedImage[];

  blogPosts: string[];

  photoAnalysis?: PhotoAnalysis;

  styleProfile?: StyleProfile;

  draft?: string;

  finalDraft?: string;
}
```

---

# 타입 정의

## PhotoAnalysis

```ts
export interface PhotoAnalysis {
  places: string[];

  activities: string[];

  foods: string[];

  mood: string;

  timeline: TimelineItem[];
}
```

## StyleProfile

```ts
export interface StyleProfile {
  tone: string;

  endingPattern: string;

  emojiLevel: number;

  paragraphLength: string;

  writingStyle: string;
}
```

---

# 프로젝트 구조

```text
src

├── blog-agent
│
├── graph
│   ├── state.ts
│   ├── graph.ts
│   └── nodes
│       ├── photo-agent.ts
│       ├── style-agent.ts
│       ├── writer-agent.ts
│       └── reviewer-agent.ts
│
├── services
│   ├── glm.service.ts
│   ├── vision.service.ts
│   └── blog-style.service.ts
│
├── controllers
│   └── blog-agent.controller.ts
│
└── app.module.ts
```

---

# 개발 단계

## Phase 1 - GLM Vision 연동

목표

```text
사진 업로드

↓

사진 분석 결과 출력
```

산출물

* 이미지 업로드 API
* GLM-4.5V 연동
* 분석 결과 JSON 출력

---

## Phase 2 - 블로그 스타일 분석

목표

```text
블로그 글 20개 입력

↓

스타일 프로필 생성
```

산출물

* 스타일 분석 프롬프트
* StyleProfile 생성

---

## Phase 3 - LangGraph 구축

목표

```text
Photo Agent

↓

Style Agent

↓

Writer Agent

↓

Reviewer Agent
```

전체 플로우 동작

산출물

* graph.ts
* state.ts
* 노드 구현

---

## Phase 4 - Next.js UI

기능

* 사진 업로드
* 블로그 글 입력
* 생성 결과 확인

산출물

* 업로드 페이지
* 결과 페이지

---

## Phase 5 - 네이버 블로그 자동 업로드

기술

* Playwright

기능

```text
로그인

↓

글 작성

↓

발행
```

산출물

* 네이버 로그인 자동화
* 글 발행 자동화

---

# 성공 기준

사용자가

```text
사진 20~50장 업로드
```

하고

```text
기존 블로그 글 20개 제공
```

했을 때

10분 이내에

* 제목 생성
* 본문 생성
* 태그 생성

이 완료되고,

결과물이 사용자의 기존 글 스타일과 유사하다고 느껴지는 수준에 도달한다.

---

# 향후 확장 계획

## V2

* EXIF GPS 분석
* 여행 동선 자동 생성
* 장소 정보 자동 검색

## V3

* 네이버 블로그 자동 발행
* 예약 발행

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

```
```
