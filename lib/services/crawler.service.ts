import * as cheerio from 'cheerio';
import type { BlogPost, ImageTextPair } from '../types/blog';
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
  console.log('[Crawler] 세션 쿠키 설정 완료:', cookies.length, '개');
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

    console.log('[Crawler] Playwright로 블로그 크롤링 시작:', url, useSession ? '(세션 사용)' : '(세션 없음)');

    // 브라우저 런치
    const browser = await chromium.launch();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    // 저장된 쿠키 적용 (세션 사용 시)
    if (useSession && storedCookies) {
      await context.addCookies(storedCookies);
      console.log('[Crawler] 저장된 쿠키 적용 완료');
    }

    const page = await context.newPage();

    try {
      // 페이지 로드 (JavaScript 렌더링 대기 - 더 길게)
      console.log('[Crawler] 페이지 로드 시작...');
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // 네이버 블로그는 iframe을 사용하므로 iframe 찾기
      console.log('[Crawler] 페이지 내 모든 iframe 확인...');
      const frames = page.frames();
      console.log('[Crawler] 발견된 frame 개수:', frames.length);

      // 네이버 블로그 본문이 있는 frame 찾기
      let targetFrame = page.mainFrame();
      let foundIframe = false;

      for (const frame of frames) {
        const frameUrl = frame.url();
        console.log('[Crawler] Frame URL:', frameUrl);

        // 본문 frame은 보통 blog.naver.com/PostView.nhn 등의 URL을 가짐
        if (frameUrl && (frameUrl.includes('PostView') || frameUrl.includes('post') || frameUrl.includes('blog.naver.com'))) {
          console.log('[Crawler] 본문 frame 발견:', frameUrl);
          targetFrame = frame;
          foundIframe = true;
          break;
        }
      }

      // frame 렌더링 대기
      console.log('[Crawler] frame 렌더링 대기 중...');
      await targetFrame.waitForLoadState('networkidle').catch(() => {
        console.log('[Crawler] networkidle timeout, 계속 진행');
      });
      await targetFrame.waitForTimeout(2000);

      // 네이버 블로그는 중첩된 iframe 구조 (frame → mainFrame → 본문)
      // 제목은 outer frame에서, 본문은 중첩 frame에서 가져오기
      console.log('[Crawler] 중첩 iframe 확인...');

      // 제목은 outer frame의 title 태그에서 추출
      const outerTitle = await targetFrame.evaluate(() => {
        return document.title || '';
      });
      console.log('[Crawler] outer frame title:', outerTitle);

      const nestedIframe = await targetFrame.$('iframe#mainFrame');
      let contentHtml = '';

      if (nestedIframe) {
        console.log('[Crawler] 중첩 mainFrame 발견, 내부로 접근...');
        const nestedFrame = await nestedIframe.contentFrame();
        if (nestedFrame) {
          // 중첩 frame 렌더링 대기
          await nestedFrame.waitForLoadState('networkidle').catch(() => {});
          await nestedFrame.waitForTimeout(3000);
          contentHtml = await nestedFrame.evaluate(() => {
            return document.body?.innerHTML || document.documentElement?.outerHTML || '';
          });
          console.log('[Crawler] 중첩 frame 내부 HTML 길이:', contentHtml.length);
        } else {
          console.warn('[Crawler] 중첩 frame 접근 실패');
          contentHtml = await targetFrame.evaluate(() => {
            return document.body?.innerHTML || '';
          });
        }
      } else {
        console.log('[Crawler] 중첩 iframe 없음, 현재 frame 사용');
        contentHtml = await targetFrame.evaluate(() => {
          return document.body?.innerHTML || document.documentElement?.outerHTML || '';
        });
      }

      console.log('[Crawler] 사용하는 frame:', nestedIframe ? 'nested mainFrame (본문)' : '현재 frame');
      console.log('[Crawler] 전체 HTML 길이:', contentHtml.length);

      console.log('[Crawler] 전체 HTML 길이:', contentHtml.length);
      console.log('[Crawler] HTML 미리보기 (처리 1000자):', contentHtml.substring(0, 1000));

      const $ = cheerio.load(contentHtml);

      // 네이버 블로그 본문 선택자
      const title = this.extractTitle($, outerTitle);
      const content = this.extractContent($);
      const imageTextPairs = this.extractImageTextPairs($);

      console.log('[Crawler] 크롤링 결과:', {
        titleLength: title.length,
        contentLength: content.length,
        titlePreview: title.substring(0, 50),
        imageCount: imageTextPairs.length,
      });

      if (!title && !content) {
        console.warn('[Crawler] 제목과 본문을 모두 찾지 못함');
      }

      return {
        title,
        content,
        url,
        imageTextPairs,
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
      console.log('[Crawler] outer title 사용:', outerTitle);
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
        console.log('[Crawler] outer title에서 제목 추출:', cleanTitle);
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
        console.log(`[Crawler] 제목 발견 (${selector}):`, title);
        return title;
      }
    }

    // title 태그에서 블로그 이름 제거하고 시도
    const htmlTitle = $('title').text().trim();
    console.log('[Crawler] HTML title 원본:', htmlTitle);
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
        console.log('[Crawler] HTML title에서 제목 추출:', cleanTitle);
        return cleanTitle;
      }
    }

    console.warn('[Crawler] 제목을 찾지 못함, 사용한 선택자:', titleSelectors);
    // 디버깅: 사용 가능한 모든 h1, h2, h3 태그 출력
    console.log('[Crawler] 발견된 제목 태그들:');
    $('h1, h2, h3').each((i, el) => {
      console.log(`[Crawler] - ${$(el).get(0).tagName}: ${$(el).text().trim().substring(0, 50)}`);
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
          console.log(`[Crawler] 본문 발견 (${selector}):`, text.length, '자');
          console.log(`[Crawler] 본문 내용 (3000자):`, text.substring(0, 3000));
          return text;
        }
      }
    }

    console.warn('[Crawler] 본문을 찾지 못함, 사용한 선택자:', contentSelectors);
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
   * 이미지-텍스트 쌍 추출
   * 각 이미지와 그 다음에 오는 텍스트를 쌍으로 추출
   */
  private extractImageTextPairs($: cheerio.CheerioAPI): ImageTextPair[] {
    const pairs: ImageTextPair[] = [];

    try {
      // 본문 컨테이너 찾기
      const contentContainer = this.findContentContainer($);
      if (!contentContainer || contentContainer.length === 0) {
        console.warn('[Crawler] 본문 컨테이너를 찾지 못함');
        return pairs;
      }

      // 모든 이미지 찾기
      const allImages = contentContainer.find('img').toArray();
      console.log('[Crawler] 발견된 전체 이미지 개수:', allImages.length);

      // 본문 이미지만 필터링
      const contentImages = allImages.filter(img => {
        const $img = cheerio.load(img);
        const url = $img('img').attr('src') || '';
        return this.isContentImage(url);
      });
      console.log('[Crawler] 필터링된 본문 이미지 개수:', contentImages.length);

      contentImages.forEach((img, index) => {
        const $img = cheerio.load(img);
        const imageUrl = $img('img').attr('src') || '';
        const altText = $img('img').attr('alt') || '';

        // 이미지 다음에 오는 텍스트 추출 (섹션 기반)
        const textAfter = this.extractTextAfterImage($, contentContainer, img);

        if (imageUrl || textAfter) {
          pairs.push({
            imageUrl,
            altText,
            textAfter,
          });
          console.log(`[Crawler] 이미지 ${index + 1}: URL=${imageUrl.substring(0, 50)}..., 텍스트 길이=${textAfter.length}`);
        }
      });

    } catch (error) {
      console.error('[Crawler] 이미지-텍스트 쌍 추출 오류:', error);
    }

    return pairs;
  }

  /**
   * 본문 컨테이너 찾기
   * 네이버 블로그의 구조에 맞는 선택자 사용
   */
  private findContentContainer($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
    const selectors = [
      '#postViewArea',              // 네이버 블로그 본문 영역 (가장 확실)
      '.se-main-content',           // 스마트에디터 본문
      '[id^="SE-"]',                // UUID 기반 섹션 컨테이너
      '.se-content',                // 에디터 컨텐츠
      '.se-viewer .se-section',     // 뷰어 섹션
    ];

    for (const selector of selectors) {
      const container = $(selector).first();
      if (container.length > 0) {
        console.log(`[Crawler] 본문 컨테이너 발견 (${selector})`);
        return container;
      }
    }

    console.warn('[Crawler] 본문 컨테이너를 찾지 못함, body 사용');
    return $('body');
  }

  /**
   * 이미지 다음에 오는 텍스트 추출 (섹션 기반)
   * 네이버 블로그 구조: 이미지와 텍스트가 별도 섹션(#SE-uuid)에 있음
   */
  private extractTextAfterImage(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    currentImg: any
  ): string {
    try {
      const $currentImg = $(currentImg);

      // 1. 캡션 텍스트 확인 (이미지 바로 옆에 있는 캡션)
      const parent = $currentImg.parent();
      const caption = parent?.find('.se-caption, .se-image-caption, .se-sticker-caption').text();
      if (caption && caption.trim().length > 0) {
        return this.cleanText(caption);
      }

      // 2. 현재 이미지가 속한 섹션 찾기
      const currentSection = $currentImg.closest('[id^="SE-"], .se-section, .se-component-content');
      if (!currentSection.length) {
        // 섹션을 찾지 못하면 기존 방식 사용
        return this.extractTextAfterImageLegacy($, container, currentImg);
      }

      // 3. 현재 섹션 다음 섹션들의 텍스트 수집 (너무 길지 않게)
      let text = '';
      let nextSection = currentSection.nextAll('[id^="SE-"], .se-section, .se-component-content').first();

      // 최대 3개 섹션까지만 텍스트 수집
      let sectionCount = 0;
      const maxSections = 3;

      while (nextSection.length && sectionCount < maxSections) {
        const sectionText = nextSection.text();

        // 이미지 섹션이면 중지 (이미지가 다시 시작되면 텍스트 끝)
        if (nextSection.find('img').length > 0) {
          break;
        }

        text += sectionText + ' ';
        sectionCount++;

        // 다음 섹션으로 이동
        nextSection = nextSection.nextAll('[id^="SE-"], .se-section, .se-component-content').first();
      }

      const cleaned = this.cleanText(text);

      // 너무 길면 앞부분만 반환 (최대 500자)
      if (cleaned.length > 500) {
        // 문장 단위로 자르기
        const sentences = cleaned.split(/[.!?]/).filter(s => s.trim().length > 0);
        return sentences.slice(0, 3).join('. ') + '.';
      }

      return cleaned;
    } catch (error) {
      console.error('[Crawler] 텍스트 추출 오류:', error);
      return this.extractTextAfterImageLegacy($, container, currentImg);
    }
  }

  /**
   * 기존 텍스트 추출 방식 (fallback)
   */
  private extractTextAfterImageLegacy(
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
          // 다음 요소가 이미지이면 중지
          if (elem.type === 'tag' && elem.tagName === 'img') {
            return false;
          }

          // 텍스트 노드 또는 요소에서 텍스트 추출
          if (elem.type === 'text') {
            text += elem.data;
          } else if (elem.type === 'tag') {
            const $elem = $(elem);
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
      console.error('[Crawler] 레거시 텍스트 추출 오류:', error);
      return '';
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
