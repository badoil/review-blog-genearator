'use client';

import { useState, useEffect } from 'react';

interface SavedPostSummary {
  id: string;
  createdAt: string;
  title: string;
  imageCount: number;
  uploadedToNaver?: boolean;
  naverUrl?: string;
}

/**
 * 블로그 글 렌더링 컴포넌트
 * HTML이 포함되어 있으면 dangerouslySetInnerHTML 사용
 */
function RenderedContent({ content }: { content: string }) {
  // HTML 태그가 포함되어 있는지 확인
  const hasHtml = /<img|<h[1-6]|<p|<div|<br/i.test(content);

  if (hasHtml) {
    return (
      <div
        className="prose prose-zinc dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // HTML이 없으면 일반 텍스트로 표시
  return <div className="whitespace-pre-wrap">{content}</div>;
}

export default function Home() {
  // 기존 상태
  const [blogUrls, setBlogUrls] = useState(['', '']);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Map<number, string>>(new Map()); // 이미지 미리보기 URL
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 저장 관련 상태
  const [savedPosts, setSavedPosts] = useState<SavedPostSummary[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 네이버 블로그 ID 상태
  const [naverBlogId, setNaverBlogId] = useState('');

  // 생성된 데이터 저장 (저장용)
  const [generatedData, setGeneratedData] = useState<{
    finalPost?: string;
    photoAnalysis?: any;
    styleProfile?: any;
    blogUrls?: string[];
  }>({});

  // 로그인 상태 확인
  useEffect(() => {
    checkLoginStatus();
    loadSavedPosts();
    // localStorage에서 네이버 블로그 ID 불러오기
    const savedId = localStorage.getItem('naverBlogId');
    if (savedId) {
      setNaverBlogId(savedId);
    }
  }, []);

  // 네이버 블로그 ID가 변경되면 localStorage에 저장
  useEffect(() => {
    if (naverBlogId) {
      localStorage.setItem('naverBlogId', naverBlogId);
    }
  }, [naverBlogId]);

  // 로그인 상태 확인
  useEffect(() => {
    checkLoginStatus();
    loadSavedPosts();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const response = await fetch('/api/naver/status');
      const data = await response.json();
      setIsLoggedIn(data.isLoggedIn);
    } catch (err) {
      console.error('로그인 상태 확인 실패:', err);
    }
  };

  // 저장된 글 목록 불러오기
  const loadSavedPosts = async () => {
    try {
      setIsLoadingSaved(true);
      const response = await fetch('/api/posts/list');
      const data = await response.json();
      setSavedPosts(data);
    } catch (err) {
      console.error('저장된 글 목록 불러오기 실패:', err);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  // 저장된 글 불러오기
  const loadSavedPost = async (id: string) => {
    try {
      const response = await fetch(`/api/posts/${id}`);
      if (!response.ok) {
        throw new Error('글 불러오기 실패');
      }
      const data = await response.json();

      // 결과에 표시
      setResult(data.finalPost);

      // 저장된 데이터도 업데이트
      setGeneratedData({
        finalPost: data.finalPost,
        photoAnalysis: data.photoAnalysis,
        styleProfile: data.styleProfile,
        blogUrls: data.blogUrls,
      });

      setSelectedPostId(id);
    } catch (err) {
      alert(`글 불러오기 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    }
  };

  // 저장된 글 삭제
  const deleteSavedPost = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 클릭 이벤트 전파 방지

    if (!confirm('정말 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('삭제 실패');
      }

      // 목록에서 제거
      setSavedPosts((prev) => prev.filter((p) => p.id !== id));

      // 현재 불러온 글이면 초기화
      if (selectedPostId === id) {
        setResult(null);
        setGeneratedData({});
        setSelectedPostId(null);
      }
    } catch (err) {
      alert(`삭제 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    }
  };

  // 블로그 URL 입력 처리
  const handleBlogUrlChange = (index: number, value: string) => {
    const newUrls = [...blogUrls];
    newUrls[index] = value;
    setBlogUrls(newUrls);
  };

  // 이미지 업로드 처리
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const startIndex = images.length;

    // HEIC 파일을 JPEG로 변환
    const processedFiles = await Promise.all(
      files.map(async (file, index) => {
        // HEIC 파일 확인
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          try {
            // heic2any로 변환 (다이나믹 임포트)
            const heic2any = await import('heic2any');
            const blob = await heic2any.default({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.8,
            }) as Blob;

            // 변환된 Blob을 File로 변환
            const convertedFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            // 미리보기 URL 생성
            const previewUrl = URL.createObjectURL(convertedFile);
            setImagePreviews((prev) => new Map(prev).set(startIndex + index, previewUrl));

            return convertedFile;
          } catch (error) {
            console.error('HEIC 변환 실패:', error);
            // 변환 실패 시 원본 파일 사용
            return file;
          }
        }

        // HEIC가 아닌 파일은 그대로 사용
        const previewUrl = URL.createObjectURL(file);
        setImagePreviews((prev) => new Map(prev).set(startIndex + index, previewUrl));
        return file;
      })
    );

    setImages((prev) => [...prev, ...processedFiles]);
  };

  // 이미지 제거
  const removeImage = (index: number) => {
    // 미리보기 URL 해제
    const previewUrl = imagePreviews.get(index);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setImagePreviews((prev) => {
        const newMap = new Map(prev);
        newMap.delete(index);
        return newMap;
      });
    }

    // 인덱스 조정
    const newMap = new Map<number, string>();
    let idx = 0;
    for (const [i, url] of imagePreviews) {
      if (i < index) {
        newMap.set(idx++, url);
      } else if (i > index) {
        newMap.set(idx++, url);
      }
    }
    setImagePreviews(newMap);

    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // 네이버 로그아웃
  const handleNaverLogout = async () => {
    try {
      const response = await fetch('/api/naver/logout', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setIsLoggedIn(false);
        alert('로그아웃되었습니다.');
      }
    } catch (err) {
      alert(`로그아웃 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    }
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
      setIsLoggedIn(true);
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
    setSelectedPostId(null);

    try {
      // 이미지를 FormData로 변환
      const formData = new FormData();
      images.forEach((img) => formData.append('images', img));
      blogUrls.forEach((url) => formData.append('blogUrls', url));

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('블로그 생성 실패');
      }

      const data = await response.json();

      // 이미지가 포함된 HTML이 있으면 사용, 없으면 일반 텍스트 사용
      const content = data.finalContentWithImages || data.finalPost || data.draft;
      setResult(content);

      // 디버깅: imagePlacements와 내용 출력
      console.log('=== 디버깅 정보 ===');
      console.log('이미지 배치 정보:', data.imagePlacements);
      console.log('finalContentWithImages 길이:', data.finalContentWithImages?.length);
      console.log('draft 길이:', data.draft?.length);
      console.log('원본 draft (처음 500자):', data.draft?.substring(0, 500));

      // 저장용 데이터 저장
      setGeneratedData({
        finalPost: data.finalPost || data.draft,
        photoAnalysis: data.photoAnalysis,
        styleProfile: data.styleProfile,
        blogUrls: blogUrls.filter((u) => u),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsGenerating(false);
    }
  };

  // 글 저장
  const handleSavePost = async () => {
    if (!generatedData.finalPost) {
      alert('저장할 글이 없습니다.');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('post', generatedData.finalPost);
      formData.append('photoAnalysis', JSON.stringify(generatedData.photoAnalysis || {}));
      formData.append('styleProfile', JSON.stringify(generatedData.styleProfile || {}));
      generatedData.blogUrls?.forEach((url) => formData.append('blogUrls', url));
      images.forEach((img) => formData.append('images', img));

      const response = await fetch('/api/posts/save', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('저장 실패');
      }

      const data = await response.json();
      alert('저장되었습니다!');
      setSelectedPostId(data.id);

      // 목록 새로고침
      await loadSavedPosts();
    } catch (err) {
      alert(`저장 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 네이버 업로드 (이미지 포함)
  const handleNaverUpload = async () => {
    if (!result) return;

    if (!naverBlogId) {
      alert('네이버 블로그 ID를 입력해주세요.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('post', result);
      formData.append('naverBlogId', naverBlogId);
      images.forEach((img) => formData.append('images', img));

      const response = await fetch('/api/naver/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.needLogin || !response.ok) {
        setIsLoggedIn(false);
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

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="max-w-4xl mx-auto py-12 px-4">
        {/* 헤더: 제목 + 로그인 상태 */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">📸 Photo-to-Naver Blog</h1>

          {/* 로그인/로그아웃 버튼 */}
          <div className="flex gap-2">
            {isLoggedIn ? (
              <button
                onClick={handleNaverLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                로그아웃
              </button>
            ) : (
              <button
                onClick={handleNaverLogin}
                disabled={isLoggingIn}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition"
              >
                {isLoggingIn ? '로그인 중...' : '네이버 로그인'}
              </button>
            )}
            {!isLoggedIn && (
              <span className="text-sm text-zinc-500 flex items-center">(로그인 후 발행 가능)</span>
            )}
          </div>
        </div>

        {/* 저장된 글 목록 */}
        <div className="mb-6 bg-white dark:bg-zinc-900 rounded-xl shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">📚 저장된 글</h2>
            <button
              onClick={loadSavedPosts}
              disabled={isLoadingSaved}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:text-zinc-400"
            >
              {isLoadingSaved ? '새로고침 중...' : '새로고침'}
            </button>
          </div>

          {savedPosts.length === 0 ? (
            <p className="text-sm text-zinc-500">저장된 글이 없습니다.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {savedPosts.map((post) => (
                <div
                  key={post.id}
                  className={`flex justify-between items-center p-2 rounded-lg cursor-pointer transition ${
                    selectedPostId === post.id
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  onClick={() => loadSavedPost(post.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{post.title}</div>
                    <div className="text-xs text-zinc-500">
                      {formatDate(post.createdAt)} • 이미지 {post.imageCount}장
                      {post.uploadedToNaver && ' ✅'}
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteSavedPost(post.id, e)}
                    className="ml-2 text-red-500 hover:text-red-700 text-sm px-2"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8">
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
                      src={imagePreviews.get(index) || URL.createObjectURL(img)}
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
            disabled={isGenerating || images.length === 0 || blogUrls.filter((u) => u).length === 0}
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

              {/* 생성된 글 (이미지 포함) */}
              <div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg mb-4">
                <RenderedContent content={result} />
              </div>

              {/* 네이버 블로그 ID 입력 */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  네이버 블로그 ID
                  <span className="text-zinc-500 ml-2">(예: wowjump)</span>
                </label>
                <input
                  type="text"
                  placeholder="네이버 블로그 ID 입력"
                  value={naverBlogId}
                  onChange={(e) => setNaverBlogId(e.target.value)}
                  className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  블로그 URL에서 ID를 확인할 수 있습니다: https://blog.naver.com/<strong className="text-zinc-700">{naverBlogId || 'ID'}</strong>
                </p>
              </div>

              {/* 이미지 배치 정보 (디버깅용) */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs">
                <details>
                  <summary className="font-medium cursor-pointer mb-2">이미지 배치 정보 (디버깅)</summary>
                  <pre className="whitespace-pre-wrap bg-zinc-100 dark:bg-zinc-800 p-2 rounded mt-2">API에서 imagePlacements를 확인하세요. 브라우저 개발자 도구의 Network 탭에서 /api/generate 응답을 확인하세요.</pre>
                </details>
              </div>

              {/* 버튼들 */}
              <div className="flex gap-2">
                <button
                  onClick={handleSavePost}
                  disabled={isSaving}
                  className="flex-1 py-4 bg-zinc-600 hover:bg-zinc-700 disabled:bg-zinc-400 text-white font-semibold rounded-lg transition"
                >
                  {isSaving ? '저장 중...' : '💾 저장하기'}
                </button>
                <button
                  onClick={handleNaverUpload}
                  className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
                >
                  네이버 블로그에 발행하기
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
