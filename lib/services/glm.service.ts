/**
 * GLM LLM 서비스
 *
 * 이 서비스는 GLM API를 호출하여 텍스트 생성을 수행합니다.
 * 비전 모델(Gemini)은 별도 서비스로 분리되었습니다.
 */

export interface GLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * GLM API 호출을 위한 설정
 */
export interface GLMConfig {
  apiKey: string;
  baseURL?: string;
  textModel?: string;
}

export class GLMService {
  private config: GLMConfig;
  private textModel: string;

  constructor(config: GLMConfig) {
    this.config = {
      ...config,
      baseURL: config.baseURL || 'https://open.bigmodel.cn/api/paas/v4',
    };
    this.textModel = config.textModel || 'glm-4';
  }

  /**
   * 텍스트만 생성 (GLM 텍스트 모델)
   */
  async generateText(
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean = false
  ): Promise<string> {
    const messages: GLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.callGLM(messages, {
      model: this.textModel,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
    });

    return response.content;
  }

  /**
   * GLM API 호출
   */
  private async callGLM(
    messages: Array<{ role: string; content: string | Array<any> }>,
    options: {
      model?: string;
      response_format?: { type: string };
    } = {}
  ): Promise<GLMResponse> {
    const url = `${this.config.baseURL}/chat/completions`;

    const requestBody = {
      model: options.model || this.textModel,
      messages,
      temperature: 0.7,
      max_tokens: 4000,
      ...(options.response_format && { response_format: options.response_format }),
    };

    console.log('[GLM] API 호출:', {
      url,
      model: requestBody.model,
      messageCount: messages.length,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[GLM] API 에러:', response.status, error);
        throw new Error(`GLM API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      console.log('[GLM] API 응답 성공:', {
        model: data.model,
        choices: data.choices?.length,
        contentLength: data.choices?.[0]?.message?.content?.length,
        usage: data.usage,
      });

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error('[GLM] 응답 content가 없음:', JSON.stringify(data, null, 2));
        throw new Error('GLM API 응답에 content가 없습니다.');
      }

      return {
        content,
        usage: data.usage,
      };
    } catch (error) {
      console.error('[GLM] Fetch 실패:', error);
      throw error;
    }
  }

  /**
   * JSON 모드로 생성
   */
  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string
  ): Promise<T> {
    const content = await this.generateText(systemPrompt, userPrompt, true);
    console.log('[GLM] JSON 모드 응답 content:', content);

    try {
      const parsed = JSON.parse(content) as T;
      console.log('[GLM] JSON 파싱 성공:', parsed);
      return parsed;
    } catch (e) {
      console.error('[GLM] JSON 파싱 실패:', e);
      throw new Error(`JSON 파싱 실패: ${content}`);
    }
  }
}

/**
 * GLM 서비스 인스턴스 생성
 * .env.local 파일에서 API 키를 읽어옵니다.
 */
export function createGLMService(): GLMService {
  const apiKey = process.env.GLM_API_KEY || '';
  if (!apiKey) {
    throw new Error('GLM_API_KEY 환경변수가 필요합니다.');
  }

  return new GLMService({
    apiKey,
    baseURL: process.env.GLM_BASE_URL,
    textModel: process.env.GLM_TEXT_MODEL,
  });
}

// 싱글톤 인스턴스 (lazy loading)
let glmServiceInstance: GLMService | null = null;

export function getGLMService(): GLMService {
  if (!glmServiceInstance) {
    glmServiceInstance = createGLMService();
  }
  return glmServiceInstance;
}
