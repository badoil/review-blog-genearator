import { promises as fs } from 'fs';
import path from 'path';

// 디렉토리 경로
const POSTS_DIR = path.join(process.cwd(), 'saved-posts');
const IMAGES_DIR = path.join(process.cwd(), 'saved-images');

/**
 * 저장된 블로그 글 요약 정보
 */
export interface SavedPostSummary {
  id: string;
  createdAt: string;
  title: string;
  imageCount: number;
  uploadedToNaver?: boolean;
  naverUrl?: string;
}

/**
 * 저장된 블로그 글 전체 정보
 */
export interface SavedPost extends SavedPostSummary {
  finalPost: string;
  imageDir: string;
  photoAnalysis: any;
  styleProfile: any;
  blogUrls: string[];
}

/**
 * 저장할 글 데이터
 */
export interface PostToSave {
  finalPost: string;
  photoAnalysis: any;
  styleProfile: any;
  blogUrls: string[];
  images: Array<{ name: string; buffer: Buffer; type: string }>;
}

/**
 * 블로그 글 저장소 서비스
 */
export class StorageService {
  /**
   * 디렉토리 초기화
   */
  private async ensureDirs(): Promise<void> {
    await fs.mkdir(POSTS_DIR, { recursive: true });
    await fs.mkdir(IMAGES_DIR, { recursive: true });
  }

  /**
   * ID 생성 (타임스탬프 기반)
   */
  private generateId(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}-${MM}-${dd}-${HH}${mm}${ss}`;
  }

  /**
   * 제목 추출
   */
  private extractTitle(finalPost: string): string {
    const titleMatch = finalPost.match(/^#\s*(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : '제목 없음';
  }

  /**
   * 블로그 글 저장
   */
  async savePost(data: PostToSave): Promise<string> {
    await this.ensureDirs();

    const id = this.generateId();
    const imageDir = path.join(IMAGES_DIR, id);
    const postPath = path.join(POSTS_DIR, `${id}.json`);

    // 이미지 디렉토리 생성
    await fs.mkdir(imageDir, { recursive: true });

    // 이미지 저장
    for (let i = 0; i < data.images.length; i++) {
      const img = data.images[i];
      const ext = path.extname(img.name) || '.jpg';
      const imagePath = path.join(imageDir, `image-${i}${ext}`);
      await fs.writeFile(imagePath, img.buffer);
    }

    // JSON 데이터 생성
    const savedPost: SavedPost = {
      id,
      createdAt: new Date().toISOString(),
      title: this.extractTitle(data.finalPost),
      finalPost: data.finalPost,
      imageCount: data.images.length,
      imageDir,
      photoAnalysis: data.photoAnalysis,
      styleProfile: data.styleProfile,
      blogUrls: data.blogUrls,
    };

    // JSON 저장
    await fs.writeFile(postPath, JSON.stringify(savedPost, null, 2), 'utf-8');

    console.log('[Storage] 글 저장 완료:', id);
    return id;
  }

  /**
   * 블로그 글 불러오기
   */
  async loadPost(id: string): Promise<SavedPost | null> {
    const postPath = path.join(POSTS_DIR, `${id}.json`);

    try {
      const content = await fs.readFile(postPath, 'utf-8');
      const post = JSON.parse(content) as SavedPost;

      // 이미지를 base64로 변환
      const imageDir = path.join(IMAGES_DIR, id);
      try {
        const files = await fs.readdir(imageDir);
        const images = await Promise.all(
          files
            .filter((f) => f.startsWith('image-'))
            .sort()
            .map(async (filename) => {
              const imagePath = path.join(imageDir, filename);
              const buffer = await fs.readFile(imagePath);
              const ext = path.extname(filename).slice(1);
              const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext || 'jpeg'}`;
              return {
                path: filename,
                base64: `data:${mimeType};base64,${buffer.toString('base64')}`,
              };
            })
        );

        // 이미지 정보를 추가하여 반환 (프론트에서 사용)
        return { ...post, images };
      } catch {
        // 이미지 디렉토리가 없어도 글은 반환
        return { ...post, images: [] };
      }
    } catch (error) {
      console.error('[Storage] 글 불러오기 실패:', id, error);
      return null;
    }
  }

  /**
   * 저장된 글 목록
   */
  async listPosts(): Promise<SavedPostSummary[]> {
    try {
      await this.ensureDirs();
      const files = await fs.readdir(POSTS_DIR);

      const posts: SavedPostSummary[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const postPath = path.join(POSTS_DIR, file);
          try {
            const content = await fs.readFile(postPath, 'utf-8');
            const post = JSON.parse(content) as SavedPost;

            posts.push({
              id: post.id,
              createdAt: post.createdAt,
              title: post.title,
              imageCount: post.imageCount,
              uploadedToNaver: post.uploadedToNaver,
              naverUrl: post.naverUrl,
            });
          } catch (e) {
            console.error('[Storage] 파일 읽기 실패:', file, e);
          }
        }
      }

      // 최신순 정렬
      return posts.sort((a, b) => b.id.localeCompare(a.id));
    } catch (error) {
      console.error('[Storage] 목록 조회 실패:', error);
      return [];
    }
  }

  /**
   * 블로그 글 삭제
   */
  async deletePost(id: string): Promise<boolean> {
    try {
      // JSON 파일 삭제
      const postPath = path.join(POSTS_DIR, `${id}.json`);
      await fs.unlink(postPath);

      // 이미지 디렉토리 삭제
      const imageDir = path.join(IMAGES_DIR, id);
      await fs.rm(imageDir, { recursive: true, force: true });

      console.log('[Storage] 글 삭제 완료:', id);
      return true;
    } catch (error) {
      console.error('[Storage] 글 삭제 실패:', id, error);
      return false;
    }
  }

  /**
   * 네이버 업로드 정보 업데이트
   */
  async updateNaverInfo(id: string, naverUrl: string): Promise<boolean> {
    try {
      const postPath = path.join(POSTS_DIR, `${id}.json`);
      const content = await fs.readFile(postPath, 'utf-8');
      const post = JSON.parse(content) as SavedPost;

      post.uploadedToNaver = true;
      post.naverUrl = naverUrl;

      await fs.writeFile(postPath, JSON.stringify(post, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('[Storage] 네이버 정보 업데이트 실패:', id, error);
      return false;
    }
  }
}

/**
 * 싱글톤 인스턴스
 */
let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}
