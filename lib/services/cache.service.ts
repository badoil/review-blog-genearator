import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * 캐시 서비스
 * 파일 기반 캐싱을 제공합니다.
 */
export class CacheService<T> {
  private cacheDir: string;

  constructor(cacheSubDir: string) {
    this.cacheDir = path.join(process.cwd(), '.cache', cacheSubDir);
  }

  /**
   * 키 생성 (해시)
   */
  private generateKey(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * 캐시 경로 생성
   */
  private getCachePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  /**
   * 캐시 확인
   */
  async get(input: string): Promise<T | null> {
    const key = this.generateKey(input);
    const cachePath = this.getCachePath(key);

    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const data = await readFile(cachePath, 'utf-8');
      const cached = JSON.parse(data) as { data: T; timestamp: number };

      // 캐시 만료 확인 (7일)
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - cached.timestamp > maxAge) {
        // 캐시 만료, 삭제
        await unlink(cachePath);
        return null;
      }

      console.log(`[Cache] 캐시 적중 (${key.substring(0, 8)}...)`);
      return cached.data;
    } catch (error) {
      console.error('[Cache] 캐시 읽기 오류:', error);
      return null;
    }
  }

  /**
   * 캐시 저장
   */
  async set(input: string, data: T): Promise<void> {
    const key = this.generateKey(input);
    const cachePath = this.getCachePath(key);

    try {
      // 캐시 디렉토리 생성
      if (!existsSync(this.cacheDir)) {
        await mkdir(this.cacheDir, { recursive: true });
      }

      const cacheData = {
        data,
        timestamp: Date.now(),
      };

      await writeFile(cachePath, JSON.stringify(cacheData, null, 2));
      console.log(`[Cache] 캐시 저장 (${key.substring(0, 8)}...)`);
    } catch (error) {
      console.error('[Cache] 캐시 저장 오류:', error);
    }
  }

  /**
   * 캐시 삭제
   */
  async delete(input: string): Promise<void> {
    const key = this.generateKey(input);
    const cachePath = this.getCachePath(key);

    if (existsSync(cachePath)) {
      await unlink(cachePath);
      console.log(`[Cache] 캐시 삭제 (${key.substring(0, 8)}...)`);
    }
  }

  /**
   * 모든 캐시 삭제
   */
  async clear(): Promise<void> {
    // 구현 필요 시
    console.log('[Cache] 모든 캐시 삭제 (미구현)');
  }
}

// 싱글톤 인스턴스
const photoCacheService = new CacheService<any>('photo');
const styleCacheService = new CacheService<any>('style');

export function getPhotoCacheService(): CacheService<any> {
  return photoCacheService;
}

export function getStyleCacheService(): CacheService<any> {
  return styleCacheService;
}
