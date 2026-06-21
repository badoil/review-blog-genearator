import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini Vision 서비스
 * Google GenAI SDK를 사용하여 이미지 분석을 수행합니다.
 */

// 개별 이미지 분석 결과
export interface ImageAnalysis {
  index: number;           // 이미지 순서 (0-based)
  description: string;      // 이미지 전체 설명
  places: string[];         // 이 이미지에서 식별된 장소
  activities: string[];     // 이 이미지에서 식별된 활동
  foods: string[];          // 이 이미지에서 식별된 음식
  time?: string;            // 추정 시간대 (아침, 점심, 저녁 등)
  location?: string;        // 구체적 장소 이름
}

export interface PhotoAnalysis {
  images: ImageAnalysis[];  // 각 이미지별 분석 결과 (순서대로)
  places: string[];          // 전체 장소 목록 (중복 제거)
  activities: string[];      // 전체 활동 목록 (중복 제거)
  foods: string[];           // 전체 음식 목록 (중복 제거)
  mood: string;              // 전체 분위기
  timeline: TimelineItem[]; // 동선 요약
}

export interface TimelineItem {
  time?: string;
  location?: string;
  activity?: string;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  /**
   * 이미지 분석 - 각 이미지별로 분석 결과 반환
   */
  async analyzeImages(images: Array<{ base64?: string; path: string }>): Promise<PhotoAnalysis> {
    console.log('[Gemini] 이미지 분석 시작, 이미지 개수:', images.length);

    const genModel = this.genAI.getGenerativeModel({ model: this.model });

    // 시스템 프롬프트 - 각 이미지별 분석
    const systemPrompt = `당신은 사진 분석 전문가입니다.
업로드된 여행/맛집 사진들을 분석하여 각 이미지별로 다음 정보를 JSON 형식으로 추출해주세요:

{
  "images": [
    {
      "index": 0,
      "description": "이미지 전체 설명 (1-2문장)",
      "places": ["장소1", "장소2"],
      "activities": ["활동1", "활동2"],
      "foods": ["음식1", "음식2"],
      "time": "아침/점심/오후/저녁 (추정 가능한 경우)",
      "location": "구체적 장소 이름 (카페명, 식당명 등)"
    }
  ],
  "mood": "전체적인 분위기 (예: 여유로움, 활기참, 로맨틱 등)",
  "timeline": [
    {"time": "오전", "location": "장소", "activity": "활동"},
    {"time": "점심", "location": "장소", "activity": "활동"}
  ]
}

분석 가이드:
- images 배열: 각 이미지를 순서대로 분석
  - description: 이미지의 전체 내용을 간략하게 설명
  - places: 식별되는 장소 (카페, 식당, 해변, 공원 등)
  - activities: 보이는 활동 (식사, 산책, 서핑, 대화 등)
  - foods: 음식이 보이면 구체적인 메뉴 이름
  - time: 그림자/조명 등으로 시간대 추정
  - location: 간판/표지 등으로 구체적 장소명 식별
- mood: 전체 사진의 분위기를 한 단어로 표현
- timeline: 이미지 순서에 따른 동선 추정

중요: 이미지 업로드 순서대로 index를 0, 1, 2... 부여하세요.`;

    // 이미지 파트 준비
    const imageParts = images.map((img, idx) => {
      if (img.base64) {
        const base64Data = img.base64.split(',')[1] || img.base64;
        return {
          inlineData: {
            data: base64Data,
            mimeType: this.getMimeType(img.base64),
          },
        };
      }
      throw new Error('파일 경로는 지원하지 않습니다. base64가 필요합니다.');
    });

    const userPrompt = `다음 ${images.length}장의 사진을 순서대로 분석해주세요. JSON 형식으로만 응답해주세요.

이미지 순서: ${images.map((_, i) => `#${i}`).join(', ')}`;

    try {
      const result = await genModel.generateContent([
        systemPrompt,
        userPrompt,
        ...imageParts,
      ]);

      const response = result.response;
      const text = response.text();

      console.log('[Gemini] 응답 길이:', text.length);
      console.log('[Gemini] 응답 미리보기 (300자):', text.substring(0, 300));

      // JSON 파싱
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON 응답을 찾을 수 없습니다.');
      }

      const parsed = JSON.parse(jsonMatch[0]) as any;

      // 전체 장소/활동/음식 목록 추출 (중복 제거)
      const allPlaces = new Set<string>();
      const allActivities = new Set<string>();
      const allFoods = new Set<string>();

      parsed.images?.forEach((img: ImageAnalysis) => {
        img.places?.forEach(p => allPlaces.add(p));
        img.activities?.forEach(a => allActivities.add(a));
        img.foods?.forEach(f => allFoods.add(f));
      });

      // PhotoAnalysis 형식으로 변환
      const photoAnalysis: PhotoAnalysis = {
        images: parsed.images || [],
        places: Array.from(allPlaces),
        activities: Array.from(allActivities),
        foods: Array.from(allFoods),
        mood: parsed.mood || '',
        timeline: parsed.timeline || [],
      };

      console.log('[Gemini] 이미지 분석 완료:', {
        imageCount: photoAnalysis.images.length,
        places: photoAnalysis.places,
        activities: photoAnalysis.activities,
        foods: photoAnalysis.foods,
        mood: photoAnalysis.mood,
      });

      return photoAnalysis;
    } catch (error) {
      console.error('[Gemini] 이미지 분석 실패:', error);
      throw error;
    }
  }

  /**
   * base64 문자열에서 MIME 타입 추출
   */
  private getMimeType(base64: string): string {
    const match = base64.match(/^data:([^;]+);base64/);
    return match ? match[1] : 'image/jpeg';
  }
}

// 싱글톤 인스턴스
let geminiServiceInstance: GeminiService | null = null;

export function getGeminiService(): GeminiService {
  if (!geminiServiceInstance) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY 환경변수가 필요합니다.');
    }
    geminiServiceInstance = new GeminiService(apiKey, process.env.GEMINI_MODEL || 'gemini-2.5-flash');
  }
  return geminiServiceInstance;
}
