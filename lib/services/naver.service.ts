import { chromium, Browser, Page, BrowserContext } from 'playwright';
import type { FinalPost, NaverCredentials, UploadResult } from '../types/blog';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 네이버 블로그 자동 업로드 서비스
 * Playwright를 사용하여 네이버 블로그에 로그인하고 글을 발행합니다.
 */
export class NaverBlogService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  /**
   * 브라우저 초기화
   */
  private async initBrowser(): Promise<void> {
    if (this.browser) {
      return; // 이미 초기화됨
    }

    // 헤드리스 모드로 Chromium 실행
    this.browser = await chromium.launch({
      headless: false, // 디버깅을 위해 false 설정 (실제 운영 시 true)
      slowMo: 500, // 조작 속도 늦추기 (자동화 감지 방지)
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    this.page = await this.context.newPage();
  }

  /**
   * 네이버 로그인
   * 사용자가 직접 로그인하는 대화형 방식
   */
  async login(): Promise<void> {
    await this.initBrowser();

    if (!this.page) {
      throw new Error('페이지가 초기화되지 않았습니다.');
    }

    // 네이버 로그인 페이지로 이동
    await this.page.goto('https://nid.naver.com/nidlogin.login');

    // 사용자가 직접 로그인하도록 안내
    console.log('브라우저가 열렸습니다. 2분 이내에 로그인을 완료해주세요.');
    console.log('로그인이 완료되면 Enter를 눌러주세요...');

    // 로그인 완료 대기 (사용자 입력 대기 또는 URL 변경 감지)
    await this.waitForLogin();
  }

  /**
   * 로그인 완료 대기
   */
  private async waitForLogin(): Promise<void> {
    if (!this.page) {
      throw new Error('페이지가 초기화되지 않았습니다.');
    }

    // 네이버 메인 페이지로 리다이렉트되면 로그인 성공으로 간주
    try {
      await this.page.waitForURL('**/naver.com', { timeout: 120000 });
      console.log('로그인이 완료되었습니다.');
    } catch {
      // 타임아웃된 경우도 계속 진행
      console.log('로그인 대기 시간이 초과되었습니다. 계속 진행합니다.');
    }
  }

  /**
   * 세션 저장 (다음 사용을 위해)
   */
  async saveSession(savePath: string): Promise<void> {
    if (!this.context) {
      throw new Error('컨텍스트가 초기화되지 않았습니다.');
    }
    await this.context.storageState({ path: savePath });
  }

  /**
   * 저장된 세션으로 로드
   */
  async loadSession(sessionPath: string): Promise<void> {
    await this.initBrowser();
    if (!this.browser || !this.context) {
      throw new Error('브라우저 초기화 실패');
    }
    await this.context.close();
    this.context = await this.browser.newContext({
      storageState: sessionPath,
    });
    this.page = await this.context.newPage();
  }

  /**
   * 이미지 업로드
   * 네이버 블로그 에디터의 이미지 업로드 기능을 사용합니다.
   */
  private async uploadImages(imagePaths: string[]): Promise<void> {
    if (!this.page || imagePaths.length === 0) {
      return;
    }

    console.log('[Naver] 이미지 업로드 시작, 개수:', imagePaths.length);

    // 네이버 블로그 에디터의 이미지 업로드 버튼 선택자
    // 실제 네이버 블로그 에디터 구조에 따라 다를 수 있음
    const imageUploadSelectors = [
      'button.se-btn-image',           // 에디터 툴바의 이미지 버튼
      '.se-rte-control-image',         // 이미지 컨트롤
      'button[title="이미지"]',       // 이미지 버튼 (title 속성)
      '.se-image-button',              // 이미지 버튼 클래스
    ];

    // 이미지 업로드 버튼 찾기
    let uploadButton: any = null;
    for (const selector of imageUploadSelectors) {
      try {
        uploadButton = await this.page.$(selector);
        if (uploadButton) {
          console.log('[Naver] 이미지 업로드 버튼 찾음:', selector);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!uploadButton) {
      console.log('[Naver] 이미지 업로드 버튼을 찾지 못했습니다. 파일 입력을 시도합니다.');
      // 대안: 파일 입력 직접 사용
      try {
        const fileInput = await this.page.$('input[type="file"]');
        if (fileInput) {
          for (const imagePath of imagePaths) {
            if (fs.existsSync(imagePath)) {
              await fileInput.setInputFiles(imagePath);
              await this.page.waitForTimeout(2000); // 업로드 대기
              console.log('[Naver] 이미지 업로드 완료:', imagePath);
            }
          }
        }
      } catch (e) {
        console.log('[Naver] 파일 입력 업로드 실패:', e);
      }
      return;
    }

    // 이미지 업로드 버튼 클릭
    await uploadButton.click();
    await this.page.waitForTimeout(1000);

    // 파일 입력 창이 나타날 때까지 대기
    const fileInputSelector = 'input[type="file"]';
    await this.page.waitForSelector(fileInputSelector, { timeout: 5000 });

    // 각 이미지 업로드
    for (const imagePath of imagePaths) {
      if (!fs.existsSync(imagePath)) {
        console.log('[Naver] 파일 없음, 건너뜀:', imagePath);
        continue;
      }

      try {
        const fileInput = await this.page.$(fileInputSelector);
        if (fileInput) {
          await fileInput.setInputFiles(imagePath);
          await this.page.waitForTimeout(2000); // 업로드 대기
          console.log('[Naver] 이미지 업로드 완료:', imagePath);
        }
      } catch (e) {
        console.error('[Naver] 이미지 업로드 실패:', imagePath, e);
      }
    }
  }

  /**
   * 블로그 글 발행
   */
  async uploadPost(
    post: FinalPost,
    options?: { imagePaths?: string[] }
  ): Promise<UploadResult> {
    try {
      if (!this.page) {
        throw new Error('페이지가 초기화되지 않았습니다. 먼저 login()을 호출해주세요.');
      }

      console.log('[Naver] 블로그 글 발행 시작');
      console.log('[Naver] 제목:', post.title);

      // 네이버 블로그 글쓰기 페이지로 이동
      await this.page.goto('https://blog.naver.com/PostWrite.nhn', {
        waitUntil: 'networkidle',
      });

      // 페이지가 로드될 때까지 대기
      await this.page.waitForLoadState('networkidle');

      // 제목 입력
      const titleSelector = '#title';
      await this.page.waitForSelector(titleSelector, { timeout: 10000 });
      await this.page.fill(titleSelector, post.title);
      console.log('[Naver] 제목 입력 완료');

      // 이미지 업로드 (있는 경우)
      if (options?.imagePaths && options.imagePaths.length > 0) {
        await this.uploadImages(options.imagePaths);
      }

      // 본문 입력
      console.log('[Naver] 본문 입력 시작');
      const contentSelector = '.se-editable.se-content-text';

      // 네이버 블로그 에디터는 iframe 안에 있는 경우가 많음
      try {
        // 메인 프레임 확인
        const frame = this.page.frame('mainFrame');
        if (frame) {
          console.log('[Naver] iframe 에디터 사용');
          await frame.waitForSelector('body', { timeout: 10000 });
          await frame.evaluate((content) => {
            const body = frame?.document?.body;
            if (body) {
              body.innerHTML = content;
            }
          }, post.content);
        } else {
          // 일반적인 경우 - contenteditable 요소 찾기
          console.log('[Naver] contenteditable 요소 찾기');
          await this.page.waitForSelector('[contenteditable="true"]', { timeout: 10000 });

          // 첫 번째 contenteditable 요소에 본문 입력
          const editor = await this.page.$('[contenteditable="true"]');
          if (editor) {
            await editor.click(); // 포커스
            await this.page.keyboard.type(post.content, { delay: 10 });
            console.log('[Naver] 본문 입력 완료');
          }
        }
      } catch (e) {
        console.log('[Naver] 본문 입력 실패, 대안 시도:', e);
        // 대안: clipboard를 사용한 붙여넣기
        await this.page.evaluate((content) => {
          navigator.clipboard.writeText(content);
        }, post.content);

        await this.page.waitForSelector('[contenteditable="true"]', { timeout: 10000 });
        const editor = await this.page.$('[contenteditable="true"]');
        if (editor) {
          await editor.click();
          // Ctrl+V 또는 Cmd+V
          await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Ctrl+V');
          await this.page.waitForTimeout(1000);
        }
      }

      // 태그 입력
      if (post.tags && post.tags.length > 0) {
        console.log('[Naver] 태그 입력 시작');
        const tagSelector = '.tag_input';
        try {
          await this.page.waitForSelector(tagSelector, { timeout: 5000 });
          for (const tag of post.tags) {
            await this.page.fill(tagSelector, tag);
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(500); // 태그가 추가될 때까지 대기
          }
          console.log('[Naver] 태그 입력 완료');
        } catch {
          console.log('[Naver] 태그 입력을 건너뜁니다.');
        }
      }

      // 발행 버튼 클릭
      console.log('[Naver] 발행 버튼 클릭');
      const publishSelector = '.btn_publish';
      await this.page.waitForSelector(publishSelector, { timeout: 10000 });
      await this.page.click(publishSelector);

      // 발행 완료 대기
      await this.page.waitForURL('**/PostView.nhn**', { timeout: 30000 });
      console.log('[Naver] 발행 완료');

      // 발행된 글 URL 추출
      const publishedUrl = this.page.url();

      return {
        success: true,
        url: publishedUrl,
      };
    } catch (error) {
      console.error('[Naver] 업로드 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}

/**
 * 싱글톤 인스턴스
 */
let naverBlogServiceInstance: NaverBlogService | null = null;

export function getNaverBlogService(): NaverBlogService {
  if (!naverBlogServiceInstance) {
    naverBlogServiceInstance = new NaverBlogService();
  }
  return naverBlogServiceInstance;
}
