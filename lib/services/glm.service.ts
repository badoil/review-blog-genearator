/**
 * GLM LLM 서비스 (LangChain ChatOpenAI 기반)
 *
 * 이 서비스는 LangChain의 ChatOpenAI를 사용하여 GLM API를 호출합니다.
 * RunnableConfig를 통해 LangfuseCallbackHandler가 자동으로 처리됩니다.
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";

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
  private llm: ChatOpenAI;

  constructor(config: GLMConfig) {
    const modelName = config.textModel || "glm-4";
    const baseURL = config.baseURL || "https://open.bigmodel.cn/api/paas/v4";

    console.log('[GLM] Initializing ChatOpenAI:', { modelName, baseURL });

    this.llm = new ChatOpenAI({
      apiKey: config.apiKey,
      model: modelName,
      configuration: {
        baseURL: baseURL,
      },
      temperature: 0.7,
      maxTokens: 4000,
    });

    console.log('[GLM] ChatOpenAI initialized, model:', (this.llm as any).model || (this.llm as any).modelName);
  }

  /**
   * 텍스트만 생성 (GLM 텍스트 모델)
   * config를 통해 LangfuseCallbackHandler가 자동으로 처리됨
   */
  async generateText(
    systemPrompt: string,
    userPrompt: string,
    config?: RunnableConfig
  ): Promise<string> {
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ];

    // console.log('[GLM] LangChain API 호출:', {
    //   model: (this.llm as any).model || (this.llm as any).modelName,
    //   messageCount: messages.length,
    //   hasConfig: !!config,
    //   callbacksType: config?.callbacks?.constructor?.name,
    //   handlerCount: config?.callbacks?.handlers?.length || 0,
    //   inheritableHandlerCount: config?.callbacks?.inheritableHandlers?.length || 0,
    // });
    // console.log('[GLM] generateText RunnableConfig:', config?.callbacks?.handlers);
    // console.dir(config, { depth: 5 });

    const response = await this.llm.invoke(messages, config);
    const content = response.content as string;

    console.log('[GLM] API 응답 성공:', {
      contentLength: content.length,
    });

    return content;
  }

  /**
   * JSON 모드로 생성
   * config를 통해 LangfuseCallbackHandler가 자동으로 처리됨
   */
  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    config?: RunnableConfig
  ): Promise<T> {
    // console.log('[GLM] generateJSON RunnableConfig:', config?.callbacks?.handlers);

    const content = await this.generateText(systemPrompt, userPrompt, config);
    console.log('[GLM] JSON 모드 응답 content (길이:', content.length, ')');

    // 마크다운 코드 블록 제거
    let jsonContent = content;

    // ```json ... ``` 형식 처리
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
      console.log('[GLM] 마크다운 코드 블록 감지, 제거 완료');
    } else {
      // ``` ... ``` 형식 처리
      const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch) {
        jsonContent = codeMatch[1];
        console.log('[GLM] 마크다운 코드 블록 감지 (json 없음), 제거 완료');
      }
    }

    console.log('[GLM] 파싱할 JSON (미리보기):', jsonContent.substring(0, 200));

    try {
      const parsed = JSON.parse(jsonContent) as T;
      console.log('[GLM] JSON 파싱 성공');
      return parsed;
    } catch (e) {
      console.error('[GLM] JSON 파싱 실패:', e);
      console.error('[GLM] 실패한 내용 (500자):', jsonContent.substring(0, 500));
      throw new Error(`JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`);
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
