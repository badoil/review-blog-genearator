'use client';

import { useState } from 'react';

export default function Home() {
  const [blogUrls, setBlogUrls] = useState(['', '']);
  const [images, setImages] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultImages, setResultImages] = useState<Array<{ path: string; base64: string }>>([]);
  const [imagePlacements, setImagePlacements] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  // 블로그 URL 입력 처리
  const handleBlogUrlChange = (index: number, value: string) => {
    const newUrls = [...blogUrls];
    newUrls[index] = value;
    setBlogUrls(newUrls);
  };

  // 이미지 업로드 처리
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(prev => [...prev, ...files]);
  };

  // 이미지 제거
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // 네이버 로그인
  const handleNaverLogin = async () => {
    setIsLoggingIn(true);
    setError(null);

    try {
      const response = await fetch('/api/naver/login', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('로그인 실패');
      }

      const data = await response.json();
      alert(data.message);
      setNeedLogin(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 블로그 생성 요청
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setResultImages([]);
    setImagePlacements([]);

    try {
      // 이미지를 FormData로 변환
      const formData = new FormData();
      images.forEach(img => formData.append('images', img));
      blogUrls.forEach(url => formData.append('blogUrls', url));

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('블로그 생성 실패');
      }

      const data = await response.json();
      setResult(data.finalPost || data.draft);
      setResultImages(data.images || []);
      setImagePlacements(data.imagePlacements || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsGenerating(false);
    }
  };

  // 네이버 업로드 (이미지 포함)
  const handleNaverUpload = async () => {
    if (!result) return;

    try {
      // FormData로 이미지와 글 함께 전송
      const formData = new FormData();
      formData.append('post', result);

      // 이미지 추가
      images.forEach(img => formData.append('images', img));

      const response = await fetch('/api/naver/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.needLogin) {
        setNeedLogin(true);
        alert('먼저 네이버 로그인이 필요합니다.');
        return;
      }

      if (data.success) {
        alert('네이버 블로그에 발행되었습니다!');
        if (data.url) {
          window.open(data.url, '_blank');
        }
      } else {
        alert(`발행 실패: ${data.error}`);
      }
    } catch (err) {
      alert(`업로드 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold mb-8 text-center">
            📸 Photo-to-Naver Blog
          </h1>

          {/* 로그인 안내 */}
          {needLogin && (
            <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg">
              <p className="mb-2">네이버 로그인이 필요합니다.</p>
              <button
                onClick={handleNaverLogin}
                disabled={isLoggingIn}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white rounded-lg transition"
              >
                {isLoggingIn ? '로그인 중...' : '네이버 로그인'}
              </button>
            </div>
          )}

          {/* 블로그 URL 입력 */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">네이버 블로그 URL (2개)</h2>
            {blogUrls.map((url, index) => (
              <input
                key={index}
                type="url"
                placeholder={`블로그 URL ${index + 1}`}
                value={url}
                onChange={(e) => handleBlogUrlChange(index, e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg mb-2 bg-white dark:bg-zinc-800"
              />
            ))}
          </div>

          {/* 이미지 업로드 */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">사진 업로드</h2>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
            />
            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-4 gap-4">
                {images.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(img)}
                      alt={`upload ${index}`}
                      className="w-full h-32 object-cover rounded"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-sm opacity-0 group-hover:opacity-100 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || images.length === 0 || blogUrls.filter(u => u).length === 0}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-semibold rounded-lg transition"
          >
            {isGenerating ? '생성 중...' : '블로그 글 생성'}
          </button>

          {/* 에러 메시지 */}
          {error && (
            <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
              {error}
            </div>
          )}

          {/* 결과 표시 */}
          {result && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4">생성된 블로그 글</h2>

              {/* 이미지 미리보기 */}
              {resultImages.length > 0 && (
                <div className="mb-4 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <h3 className="text-sm font-medium mb-2">업로드된 이미지 ({resultImages.length}장)</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {resultImages.map((img, idx) => (
                      <img
                        key={idx}
                        src={img.base64}
                        alt={`result ${idx}`}
                        className="w-full h-24 object-cover rounded"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 생성된 글 */}
              <div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg whitespace-pre-wrap mb-4">
                {result}
              </div>

              {/* 이미지 배치 정보 (디버깅용) */}
              {imagePlacements.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs">
                  <h4 className="font-medium mb-1">이미지 배치 정보:</h4>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(imagePlacements, null, 2)}</pre>
                </div>
              )}

              <button
                onClick={handleNaverUpload}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
              >
                네이버 블로그에 발행하기
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
