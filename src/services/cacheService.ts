import type { CachedChapter } from '@/types';

const getCacheKey = (storyUrl: string) => `chapterCache_${storyUrl}`;

/**
 * Lấy dữ liệu chương đã được cache từ localStorage.
 * @param storyUrl URL của truyện để tạo khóa cache.
 * @param chapterUrl URL của chương cụ thể.
 * @returns Dữ liệu chương đã cache hoặc null nếu không tìm thấy.
 */
export const getCachedChapter = (storyUrl: string, chapterUrl: string): CachedChapter | null => {
  if (!storyUrl || !chapterUrl) return null;
  try {
    const storyCacheStr = localStorage.getItem(getCacheKey(storyUrl));
    if (!storyCacheStr) return null;
    const storyCache = JSON.parse(storyCacheStr);
    return storyCache[chapterUrl] || null;
  } catch (e) {
    console.error("Lỗi khi đọc cache chương:", e);
    return null;
  }
};

/**
 * Lưu dữ liệu chương vào localStorage.
 * @param storyUrl URL của truyện.
 * @param chapterUrl URL của chương.
 * @param data Dữ liệu chương (nội dung và stats) để lưu.
 */
export const setCachedChapter = (storyUrl: string, chapterUrl: string, data: CachedChapter): void => {
  if (!storyUrl || !chapterUrl) return;
  try {
    const cacheKey = getCacheKey(storyUrl);
    let storyCache: { [key: string]: CachedChapter } = {};
    const storyCacheStr = localStorage.getItem(cacheKey);
    if (storyCacheStr) {
        // Xử lý lỗi JSON có thể xảy ra
        try {
            storyCache = JSON.parse(storyCacheStr);
        } catch (e) {
            console.error("Cache hiện tại bị hỏng, tạo cache mới.", e);
            storyCache = {};
        }
    }
    storyCache[chapterUrl] = data;
    localStorage.setItem(cacheKey, JSON.stringify(storyCache));
  } catch (e) {
    console.error("Lỗi khi ghi cache chương:", e);
    // Có thể triển khai logic xóa cache cũ nếu localStorage đầy
  }
};
