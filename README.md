# Photo-to-Naver Blog Agent

사진을 업로드하면 AI가 기존 블로그 스타일을 분석하여 네이버 블로그에 자동으로 글을 발행하는 시스템입니다.

## 기능

- 📸 **사진 분석**: GLM-4.5V로 업로드된 사진 분석 (장소, 활동, 음식, 분위기)
- 📝 **스타일 분석**: 네이버 블로그 크롤링으로 기존 글쓰기 스타일 분석
- ✍️ **글 생성**: LangGraph로 사진 + 스타일 반영한 블로그 글 생성
- 🚀 **자동 발행**: Playwright로 네이버 블로그에 자동 업로드

## 기술 스택

- **Frontend + Backend**: Next.js (App Router + API Routes)
- **Agent Framework**: LangGraphJS
- **LLM**: GLM-4.5V
- **Automation**: Playwright
- **Language**: TypeScript

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx              # 메인 페이지
│   ├── api/generate/route.ts # 블로그 생성 API
│   └── api/upload/route.ts   # 네이버 업로드 API
├── lib/
│   ├── agent/
│   │   ├── graph.ts          # LangGraph 정의
│   │   ├── state.ts          # State 인터페이스
│   │   └── nodes/            # 에이전트 노드들
│   └── services/
│       ├── glm.service.ts    # GLM LLM 호출
│       ├── crawler.service.ts # 네이버 블로그 크롤링
│       └── naver.service.ts   # Playwright 네이버 업로드
```

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Playwright 브라우저 설치

```bash
npx playwright install chromium
```

### 3. 환경 변수 설정

`.env.local` 파일을 생성하고 GLM API 키를 입력하세요:

```bash
GLM_API_KEY=your_glm_api_key_here
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_VISION_MODEL=glm-4v
GLM_TEXT_MODEL=glm-5.1
```

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000에서 접속하세요.

## 사용 방법

1. **네이버 블로그 URL 입력**: 기존 블로그 글 2개의 URL을 입력합니다. (스타일 분석용)
2. **사진 업로드**: 블로그에 올릴 사진들을 업로드합니다.
3. **블로그 글 생성**: "블로그 글 생성" 버튼을 클릭합니다.
4. **결과 확인**: 생성된 글을 확인하고 수정할 수 있습니다.
5. **네이버 발행**: "네이버 블로그에 발행하기" 버튼을 클릭합니다.

## 아키텍처

```
┌─────────────────────────────────────────┐
│              Next.js App                │
│  ┌──────────────────────────────────┐   │
│  │     LangGraph (Parallel)         │   │
│  │                                  │   │
│  │  Photo Agent ──────┐             │   │
│  │                    ├──> Writer   │   │
│  │  Style Agent ──────┘    │        │   │
│  │                        │        │   │
│  │                    Reviewer     │   │
│  │                        │        │   │
│  │  ┌─────────────────────┘        │   │
│  │  ▼                              │   │
│  │ Naver Upload (Playwright)       │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## LangGraph 노드

1. **Photo Agent**: 사진 분석 (장소, 활동, 음식, 분위기 추출)
2. **Style Agent**: 블로그 스타일 분석 (말투, 이모지 사용, 문단 길이 등)
3. **Writer Agent**: 사진 분석 + 스타일로 글 생성
4. **Reviewer Agent**: 생성된 글을 자연스럽게 다듬기

## 주의사항

- 네이버 블로그 자동화는 네이버의 이용약관을 준수해야 합니다.
- 첫 실행 시 네이버 로그인이 필요할 수 있습니다.
- 이미지가 많을 경우 처리 시간이 오래 걸릴 수 있습니다.

## 라이선스

MIT
