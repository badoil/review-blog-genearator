import * as cheerio from 'cheerio';
import type { BlogPost, SectionText } from '../types/blog';
import { chromium } from 'playwright';

/**
 * 네이버 블로그 URL인지 확인
 */
function isNaverBlogUrl(url: string): boolean {
  return url.includes('blog.naver.com') || url.includes('naver.me');
}

/**
 * 네이버 블로그 글 크롤링
 * 네이버 블로그는 iframe으로 구성되어 있어서 직접 접근이 어렵습니다.
 * 실제 본문 URL로 변환해서 크롤링합니다.
 */
// 저장된 세션 쿠키 (파일에서 로드)
let storedCookies: any[] | null = null;

/**
 * 네이버 세션 쿠키 설정
 */
export function setNaverCookies(cookies: any[]) {
  storedCookies = cookies;
  // console.log('[Crawler] 세션 쿠키 설정 완료:', cookies.length, '개');
}

export class CrawlerService {
  private baseUrl = 'https://blog.naver.com';

  /**
   * 네이버 블로그 글 가져오기
   * Playwright를 사용하여 JavaScript 렌더링 후 크롤링
   * @param url 블로그 URL
   * @param useSession 저장된 세션 쿠키 사용 여부
   */
  async fetchBlogPost(url: string, useSession: boolean = false): Promise<BlogPost> {
    if (!isNaverBlogUrl(url)) {
      throw new Error('네이버 블로그 URL이 아닙니다.');
    }

    // console.log('[Crawler] Playwright로 블로그 크롤링 시작:', url, useSession ? '(세션 사용)' : '(세션 없음)');

    // 브라우저 런치
    const browser = await chromium.launch();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    // 저장된 쿠키 적용 (세션 사용 시)
    if (useSession && storedCookies) {
      await context.addCookies(storedCookies);
      // console.log('[Crawler] 저장된 쿠키 적용 완료');
    }

    const page = await context.newPage();

    try {
      // 페이지 로드 (JavaScript 렌더링 대기 - 더 길게)
      // console.log('[Crawler] 페이지 로드 시작...');
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // 네이버 블로그는 iframe을 사용하므로 iframe 찾기
      // console.log('[Crawler] 페이지 내 모든 iframe 확인...');
      const frames = page.frames();
      // console.log('[Crawler] 발견된 frame 개수:', frames.length);

      // 네이버 블로그 본문이 있는 frame 찾기
      let targetFrame = page.mainFrame();
      let foundIframe = false;

      for (const frame of frames) {
        const frameUrl = frame.url();
        // console.log('[Crawler] Frame URL:', frameUrl);

        // 본문 frame은 보통 blog.naver.com/PostView.nhn 등의 URL을 가짐
        if (frameUrl && (frameUrl.includes('PostView') || frameUrl.includes('post') || frameUrl.includes('blog.naver.com'))) {
          // console.log('[Crawler] 본문 frame 발견:', frameUrl);
          targetFrame = frame;
          foundIframe = true;
          break;
        }
      }

      // frame 렌더링 대기
      // console.log('[Crawler] frame 렌더링 대기 중...');
      await targetFrame.waitForLoadState('networkidle').catch(() => {
        // console.log('[Crawler] networkidle timeout, 계속 진행');
      });
      await targetFrame.waitForTimeout(2000);

      // 네이버 블로그는 중첩된 iframe 구조 (frame → mainFrame → 본문)
      // 제목은 outer frame에서, 본문은 중첩 frame에서 가져오기
      // console.log('[Crawler] 중첩 iframe 확인...');

      // 제목은 outer frame의 title 태그에서 추출
      const outerTitle = await targetFrame.evaluate(() => {
        return document.title || '';
      });
      // console.log('[Crawler] outer frame title:', outerTitle);

      const nestedIframe = await targetFrame.$('iframe#mainFrame');
      let contentHtml = '';

      if (nestedIframe) {
        // console.log('[Crawler] 중첩 mainFrame 발견, 내부로 접근...');
        const nestedFrame = await nestedIframe.contentFrame();
        if (nestedFrame) {
          // 중첩 frame 렌더링 대기
          await nestedFrame.waitForLoadState('networkidle').catch(() => {});
          await nestedFrame.waitForTimeout(3000);

          // 구조 분석 (Playwright로 직접 찾기)
          await this.analyzeNaverBlogStructure(nestedFrame);

          contentHtml = await nestedFrame.evaluate(() => {
            return document.body?.innerHTML || document.documentElement?.outerHTML || '';
          });
          // console.log('[Crawler] 중첩 frame 내부 HTML 길이:', contentHtml.length);
        } else {
          // console.warn('[Crawler] 중첩 frame 접근 실패');
          contentHtml = await targetFrame.evaluate(() => {
            return document.body?.innerHTML || '';
          });
        }
      } else {
        // console.log('[Crawler] 중첩 iframe 없음, 현재 frame 사용');

        // 구조 분석
        await this.analyzeNaverBlogStructure(targetFrame);

        contentHtml = await targetFrame.evaluate(() => {
          return document.body?.innerHTML || document.documentElement?.outerHTML || '';
        });
      }

      // console.log('[Crawler] 사용하는 frame:', nestedIframe ? 'nested mainFrame (본문)' : '현재 frame');
      // console.log('[Crawler] 전체 HTML 길이:', contentHtml.length);

      // console.log('[Crawler] 전체 HTML 길이:', contentHtml.length);
      // console.log('[Crawler] HTML 미리보기 (처리 1000자):', contentHtml.substring(0, 1000));

      const $ = cheerio.load(contentHtml);

      // 네이버 블로그 본문 선택자
      const title = this.extractTitle($, outerTitle);
      const content = this.extractContent($);
      const sectionTexts = this.extractSectionTexts($);

      console.log('[Crawler] 크롤링 결과:', {
        titleLength: title.length,
        contentLength: content.length,
        titlePreview: title.substring(0, 50),
        sectionCount: sectionTexts.length,
      });

      if (!title && !content) {
        // console.warn('[Crawler] 제목과 본문을 모두 찾지 못함');
      }

      return {
        title,
        content,
        url,
        sectionTexts,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * 실제 블로그 본문 URL 변환
   * blog.naver.com/ID -> 실제 본문 URL
   */
  private async getActualBlogUrl(url: string): Promise<string> {
    // 이미 본문 URL 형태인 경우
    if (url.match(/blog\.naver\.com\/.*\/\d+$/)) {
      return url;
    }

    // naver.me 단축 URL인 경우
    if (url.includes('naver.me')) {
      const response = await fetch(url, {
        redirect: 'manual',
      });
      const location = response.headers.get('location');
      if (location) {
        return location;
      }
    }

    return url;
  }

  /**
   * 제목 추출
   * @param $ Cheerio 인스턴스
   * @param outerTitle outer frame의 title 태그 내용 (옵션)
   */
  private extractTitle($: cheerio.CheerioAPI, outerTitle?: string): string {
    // outer frame의 title이 있으면 먼저 처리
    if (outerTitle) {
      // console.log('[Crawler] outer title 사용:', outerTitle);
      // 다양한 형식의 네이버 블로그 접미사 제거
      let cleanTitle = outerTitle
        .replace(/:: 네이버블로그$/, '')
        .replace(/ : 네이버블로그$/, '')
        .replace(/ : 네이버 블로그$/, '')
        .replace(/:: 네이버 블로그$/, '')
        .replace(/\s*:\s*네이버블로그.*$/, '')
        .replace(/\s*:\s*네이버 블로그.*$/, '')
        .trim();

      if (cleanTitle && cleanTitle.length > 0) {
        // console.log('[Crawler] outer title에서 제목 추출:', cleanTitle);
        return cleanTitle;
      }
    }

    // 네이버 블로그 제목 선택자 (다양한 구조 대응)
    const titleSelectors = [
      '.se-main-title',
      '.se-title',
      'h3.se-title',
      '.blog_title',
      '.se-f-title .se-title',
      '.se_title',
      'title', // HTML title 태그도 확인
    ];

    for (const selector of titleSelectors) {
      const title = $(selector).first().text().trim();
      if (title && title.length > 0 && selector !== 'title') {
        // console.log(`[Crawler] 제목 발견 (${selector}):`, title);
        return title;
      }
    }

    // title 태그에서 블로그 이름 제거하고 시도
    const htmlTitle = $('title').text().trim();
    // console.log('[Crawler] HTML title 원본:', htmlTitle);
    if (htmlTitle) {
      // 다양한 형식의 네이버 블로그 접미사 제거
      let cleanTitle = htmlTitle
        .replace(/:: 네이버블로그$/, '')
        .replace(/ : 네이버블로그$/, '')
        .replace(/ : 네이버 블로그$/, '')
        .replace(/:: 네이버 블로그$/, '')
        .replace(/\s*:\s*네이버블로그.*$/, '')
        .replace(/\s*:\s*네이버 블로그.*$/, '')
        .trim();

      if (cleanTitle && cleanTitle.length > 0) {
        // console.log('[Crawler] HTML title에서 제목 추출:', cleanTitle);
        return cleanTitle;
      }
    }

    // console.warn('[Crawler] 제목을 찾지 못함, 사용한 선택자:', titleSelectors);
    // 디버깅: 사용 가능한 모든 h1, h2, h3 태그 출력
    // console.log('[Crawler] 발견된 제목 태그들:');
    $('h1, h2, h3').each((i, el) => {
      // console.log(`[Crawler] - ${$(el).get(0).tagName}: ${$(el).text().trim().substring(0, 50)}`);
    });
    return ''; // 제목을 찾지 못한 경우
  }

  /**
   * 본문 추출
   */
  private extractContent($: cheerio.CheerioAPI): string {
    // 네이버 블로그 본문 선택자 (다양한 구조 대응)
    const contentSelectors = [
      '.se-main-content',
      '.se-content',
      '.se-text-container',
      'div.se_component',
      '#postViewArea',
      '.se-viewer',
      '.se_paragraph',
      '[data-module-type="t"]',
      '.se-main-text',
    ];

    for (const selector of contentSelectors) {
      const content = $(selector).first();
      if (content.length > 0) {
        const text = this.cleanText(content.text());
        if (text.length > 50) { // 충분한 내용이 있는지 확인
          // console.log(`[Crawler] 본문 발견 (${selector}):`, text.length, '자');
          // console.log(`[Crawler] 본문 내용 (3000자):`, text.substring(0, 3000));
          return text;
        }
      }
    }

    // console.warn('[Crawler] 본문을 찾지 못함, 사용한 선택자:', contentSelectors);
    return ''; // 본문을 찾지 못한 경우
  }

  /**
   * 텍스트 정제
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // 여러 공백을 하나로
      .replace(/\n+/g, '\n') // 여러 줄바꿈을 하나로
      .trim();
  }

  /**
   * 본문 이미지 여부 확인 (URL 패턴 기반 필터링)
   */
  private isContentImage(url: string): boolean {
    if (!url) return false;

    // 본문 이미지 URL 패턴
    const contentPatterns = [
      /postfiles\.pstatic\.net/,
      /blogfiles\.pstatic\.net/,
    ];

    // 제외할 URL 패턴 (본문 외)
    const excludePatterns = [
      /blogpfthumb/,           // 프로필 썸네일
      /map\.pstatic\.net/,      // 지도 이미지
      /ssl\.pstatic\.net\/static/, // 지도 정적 이미지
      /editor-static\.pstatic\.net/, // 에디터 관련
      /simg\.pstatic\.net/,    // 정적 맵 이미지
      /reviewnote\.cloud/,     // 외부 서비스 (필요시 제외)
    ];

    // 제외 패턴 확인
    if (excludePatterns.some(pattern => pattern.test(url))) {
      return false;
    }

    // 본문 패턴 확인
    return contentPatterns.some(pattern => pattern.test(url));
  }

  /**
   * 섹션 단위 텍스트 추출
   * 이미지를 구분선으로 사용하여 각 섹션의 텍스트 추출
   */
  private extractSectionTexts($: cheerio.CheerioAPI): SectionText[] {
    const sections: SectionText[] = [];

    try {
      // 본문 컨테이너 찾기
      let contentContainer = this.findContentContainer($);
      if (!contentContainer || contentContainer.length === 0) {
        // console.warn('[Crawler] 본문 컨테이너를 찾지 못함');
        return sections;
      }

      // 디버깅: 본문 컨테이너 내의 주요 요소 확인
      // console.log('[Crawler] 본문 컨테이너 내 요소 확인:');
      // console.log(`  - .se-component-content: ${contentContainer.find('.se-component-content').length}개`);
      // console.log(`  - .se-module-image-link: ${contentContainer.find('.se-module-image-link').length}개`);
      // console.log(`  - img: ${contentContainer.find('img').length}개`);
      // console.log(`  - [id^="SE-"]: ${contentContainer.find('[id^="SE-"]').length}개`);

      // 본문 컨테이너에 .se-component-content가 없으면 body로 다시 찾기
      if (contentContainer.find('.se-component-content').length === 0) {
        // console.log('[Crawler] 본문 컨테이너에 .se-component-content 없음, body 사용');
        contentContainer = $('body');
        // console.log('[Crawler] body 내 요소 확인:');
        // console.log(`  - .se-component-content: ${contentContainer.find('.se-component-content').length}개`);
      }

      // 네이버 블로그 구조: .se-module-image-link 안의 이미지만 찾기
      const imageLinks = contentContainer.find('.se-module-image-link').toArray();
      // console.log('[Crawler] 발견된 .se-module-image-link 개수:', imageLinks.length);

      // 각 이미지 다음 텍스트를 섹션으로 추출
      imageLinks.forEach((link, index) => {
        const $link = $(link);
        const img = $link.find('img').first();
        const imageUrl = img.attr('src') || '';

        // 본문 이미지 필터링
        if (!this.isContentImage(imageUrl)) {
          // console.log(`[Crawler] 이미지 ${index + 1}: 본문 이미지가 아님, 스킵 (${imageUrl.substring(0, 50)}...)`);
          return;
        }

        // 현재 이미지가 있는 .se-component-content 찾기
        const currentSection = $link.closest('.se-component-content');
        if (!currentSection.length) {
          // console.warn(`[Crawler] 이미지 ${index + 1}: 부모 섹션을 찾지 못함`);
          return;
        }

        // 디버깅: 현재 섹션 정보
        const currentId = currentSection.attr('id') || currentSection.attr('class') || 'unknown';
        // console.log(`[Crawler] 이미지 ${index + 1}: 현재 섹션 = ${currentId}`);

        // 다음 섹션 찾기 (상위 요소의 형제 요소 안의 .se-component-content)
        let nextSection: cheerio.Cheerio<any> = $();

        // 방법 1: 상위 요소의 형제 찾기
        const parentSection = currentSection.parent();
        if (parentSection.length) {
          // parent(.se-component-wrap 또는 #SE-xxx)의 형제 찾기
          const parentSibling = parentSection.nextAll().first();
          if (parentSibling.length) {
            // 형제 안의 .se-component-content 찾기
            nextSection = parentSibling.find('.se-component-content').first();
          }
        }

        // 방법 2: 현재 섹션 다음의 모든 .se-component-content 중 첫 번째
        if (nextSection.length === 0) {
          nextSection = currentSection.nextAll('.se-component-content').first();
        }

        // console.log(`[Crawler] 이미지 ${index + 1}: 다음 섹션 발견 = ${nextSection.length > 0 ? '있음' : '없음'}`);

        let text = '';

        if (nextSection.length) {
          // 다음 섹션의 텍스트 추출
          text = nextSection.text();
          text = this.cleanText(text);
        } else {
          // 마지막 섹션인 경우
          // console.log(`[Crawler] 이미지 ${index + 1}: 다음 섹션 없음 (마지막 이미지)`);
        }

        if (text.length > 10) {
          sections.push({ text });
          // console.log(`[Crawler] 섹션 ${index + 1}: ${text.length}자, ${this.countSentences(text)}문장`);
          // console.log(`[Crawler] 섹션 ${index + 1} 텍스트: ${text.substring(0, 100)}...`);
        } else {
          // console.log(`[Crawler] 이미지 ${index + 1}: 텍스트 없음 또는 너무 짧음 (${text.length}자)`);
        }
      });

    } catch (error) {
      // console.error('[Crawler] 섹션 텍스트 추출 오류:', error);
    }

    return sections;
  }

  /**
   * 문장 수 계산
   */
  private countSentences(text: string): number {
    return text.split(/[.!?]/).filter(s => s.trim().length > 0).length;
  }

  /**
   * 이미지 다음부터 다음 이미지까지 텍스트 추출
   */
  private extractTextUntilNextImage(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    currentImg: any
  ): string {
    try {
      let text = '';
      let foundImage = false;

      // 현재 이미지가 있는 위치부터 순회
      container.contents().each((_, elem) => {
        if (foundImage) {
          // 다음 이미지를 만나면 중지
          if (elem.type === 'tag' && elem.tagName === 'img') {
            return false; // 순환 중지
          }

          // 텍스트 노드 또는 요소에서 텍스트 추출
          if (elem.type === 'text') {
            text += elem.data;
          } else if (elem.type === 'tag') {
            const $elem = $(elem);
            // 특정 태그는 무시 (이미지, 비디오 등)
            if (!['img', 'video', 'iframe', 'script', 'style'].includes(elem.tagName)) {
              text += $elem.text();
            }
          }
        } else {
          // 현재 이미지를 찾으면 다음 요소부터 텍스트 수집 시작
          if (elem === currentImg) {
            foundImage = true;
          }
        }
      });

      return this.cleanText(text);
    } catch (error) {
      // console.error('[Crawler] 텍스트 추출 오류:', error);
      return '';
    }
  }

  /**
   * 본문 컨테이너 찾기
   * 네이버 블로그의 구조에 맞는 선택자 사용
   */
  private findContentContainer($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
    const selectors = [
      '#postViewArea',                    // 네이버 블로그 본문 영역 (가장 확실)
      '#contentArea',                     // 콘텐츠 영역
      '.se-component-wrap',               // 컴포넌트 랩 (전체 감싸는 컨테이너)
      '.se-main-content',                 // 스마트에디터 본문
      '.se-content',                      // 에디터 컨텐츠
      '.se-viewer .se-section',           // 뷰어 섹션
      // .se-component-content는 단일 섹션이므로 제외 (마지막 fallback)
    ];

    for (const selector of selectors) {
      const container = $(selector).first();
      if (container.length > 0) {
        // console.log(`[Crawler] 본문 컨테이너 발견 (${selector})`);
        return container;
      }
    }

    // fallback: 모든 .se-component-content 찾기
    const allSections = $('.se-component-content');
    if (allSections.length > 1) {
      // console.log(`[Crawler] 본문 컨테이너 발견 (.se-component-content ${allSections.length}개)`);
      // 모든 섹션을 포함하는 최상위 요소 찾기
      const parent = allSections.first().parent();
      if (parent.length) {
        // console.log(`[Crawler] 상위 컨테이너 사용 (${parent[0].tagName})`);
        return parent;
      }
    }

    // console.warn('[Crawler] 본문 컨테이너를 찾지 못함, body 사용');
    return $('body');
  }

  /**
   * 네이버 블로그 구조 분석 (Playwright로 직접 찾기)
   */
  private async analyzeNaverBlogStructure(frame: any): Promise<void> {
    try {
      // console.log('[Crawler] 네이버 블로그 구조 분석 시작...');

      // .se-component-content 찾기
      const components = await frame.locator('.se-component-content').all();
      // console.log(`[Crawler] .se-component-content 개수: ${components.length}`);

      // 각 컴포넌트 분석
      for (let i = 0; i < Math.min(components.length, 10); i++) {
        const component = components[i];
        const html = await component.innerHTML();

        // 이미지 확인
        const hasImage = html.includes('<img') || html.includes('se-module-image-link');
        // 텍스트 길이 확인
        const text = await component.textContent() || '';
        const textLength = text.trim().length;

        // console.log(`[Crawler] 컴포넌트 ${i + 1}:`);
        // console.log(`  - 이미지: ${hasImage ? '있음' : '없음'}`);
        // console.log(`  - 텍스트: ${textLength}자`);
        // console.log(`  - HTML (200자): ${html.substring(0, 200)}`);

        // 이미지가 있으면 URL 출력
        if (hasImage) {
          const imgMatch = html.match(/<img[^>]+src="([^"]+)"/);
          if (imgMatch) {
            // console.log(`  - 이미지 URL: ${imgMatch[1].substring(0, 80)}...`);
          }
        }
      }

    } catch (error) {
      // console.error('[Crawler] 구조 분석 오류:', error);
    }
  }

  /**
   * 여러 블로그 글 가져오기
   */
  async fetchMultiplePosts(urls: string[]): Promise<BlogPost[]> {
    const promises = urls.map(url => this.fetchBlogPost(url));
    return Promise.all(promises);
  }
}

// 싱글톤 인스턴스
export const crawlerService = new CrawlerService();
