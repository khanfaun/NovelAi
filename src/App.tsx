// src/App.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Story, Chapter, CharacterStats, ReadingHistoryItem, GoogleUser } from './types';
import { searchStory, getChapterContent, getStoryDetails, getStoryFromUrl } from './services/truyenfullService';
import { analyzeChapterForCharacterStats } from './services/geminiService';
import { getCachedChapter, setCachedChapter } from './services/cacheService';
import { getStoryState, saveStoryState as saveStoryStateLocal, mergeChapterStats, rebuildStateUpToChapterIndex } from './services/storyStateService';
import { useReadingSettings } from './hooks/useReadingSettings';
import { getReadingHistory, saveReadingHistoryImmediate, updateReadingHistory } from './services/history';
import * as driveSync from '@/services/sync';
import { initAutosync, enqueueChapterSync } from '@/services/autosync';

import Header from './components/Header';
import Footer from './components/Footer';
import SearchBar from './components/SearchBar';
import StoryDetail from './components/StoryDetail';
import ChapterContent from './components/ChapterContent';
import LoadingSpinner from './components/LoadingSpinner';
import CharacterPanel from './components/CharacterPanel';
import PanelToggleButton from './components/PanelToggleButton';
import SearchResultsList from './components/SearchResultsList';
import ScrollToTopButton from './components/ScrollToTopButton';
import CharacterPrimaryPanel from './components/CharacterPrimaryPanel';
import ReadingHistory from './components/ReadingHistory';
import SyncModal from './components/SyncModal';


// === Helpers: KHÔNG cần file utils riêng ===
function getChapterNumber(url: string): number | null {
  let m = url.match(/(?:chuong|chapter)[/_-](\d+)/i);
  if (m?.[1]) return parseInt(m[1], 10);
  m = url.match(/[?&](?:chuong|chapter|chap)=(\d+)/i);
  if (m?.[1]) return parseInt(m[1], 10);
  m = url.match(/(\d+)(?!.*\d)/);
  if (m?.[1]) return parseInt(m[1], 10);
  return null;
}
function getPrevChapterUrl(url: string): string {
  const n = getChapterNumber(url);
  if (n === null || n <= 1) return url;
  if (/(?:chuong|chapter)[/_-]\d+/i.test(url)) {
    return url.replace(/((?:chuong|chapter)[/_-])\d+/i, `$1${n - 1}`);
  }
  if (/[?&](?:chuong|chapter|chap)=\d+/i.test(url)) {
    return url.replace(/([?&](?:chuong|chapter|chap)=)\d+/i, `$1${n - 1}`);
  }
  return url.replace(/(\d+)(?!.*\d)/, String(n - 1));
}

// ===== Sequential Analysis Helper (thêm mới, không đụng code cũ) =====
function shouldAnalyzeSequential(prevIndex: number | null, nextIndex: number, firstEntry: boolean): boolean {
  if (firstEntry) return nextIndex === 0; // lần vào đầu, chỉ phân tích nếu đang ở chương 1 (index 0)
  return prevIndex != null && nextIndex === prevIndex + 1; // chỉ đọc liền kề N -> N+1
}

const App: React.FC = () => {
  const [searchResults, setSearchResults] = useState<Story[] | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number | null>(null);
  const [chapterContent, setChapterContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isChapterLoading, setIsChapterLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [cumulativeStats, setCumulativeStats] = useState<CharacterStats | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isPanelVisible, setIsPanelVisible] = useState<boolean>(false);

  const [readChapters, setReadChapters] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useReadingSettings();
  const [isBottomNavForReadingVisible, setIsBottomNavForReadingVisible] = useState(true);

  // States for Drive sync and history
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryItem[]>([]);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isDriveReady, setIsDriveReady] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);

  // ===== In-memory caches để tránh gọi Drive lại =====
  const aiDeltaMem = useRef(new Map<string, any>());                 // key = chapterUrl, value = AI delta
  const stateAtChapterMem = useRef(new Map<number, CharacterStats>()); // key = chapterIndex, value = cumulative state

  // ===== Track phiên đọc để quyết định phân tích liền kề =====
  const lastStoryRef = useRef<string | null>(null);
  const lastIndexRef = useRef<number | null>(null);
  const firstEntryRef = useRef<boolean>(true);

  const saveStoryState = useCallback((storyUrl: string, state: CharacterStats) => {
    saveStoryStateLocal(storyUrl, state);
    if (driveSync.isSignedIn()) {
      driveSync.saveStoryStateToDrive(storyUrl, state).catch(e => console.error("[DriveSync] Lưu story_state thất bại", e));
    }
  }, []);

  const handleSync = useCallback(async (): Promise<boolean> => {
    if (!driveSync.isSignedIn()) {
        setError('Bạn cần đăng nhập để đồng bộ.');
        return false;
    }
    try {
      const remoteHistory = await driveSync.loadHistoryFromDrive();
      const localHistory = getReadingHistory();

      const merged = new Map<string, ReadingHistoryItem>();
      [...localHistory, ...(remoteHistory || [])].forEach(item => {
        const existing = merged.get(item.url);
        if (!existing || item.lastReadTimestamp > existing.lastReadTimestamp) {
          merged.set(item.url, item);
        }
      });
      const newHistory = Array.from(merged.values())
        .sort((a, b) => b.lastReadTimestamp - a.lastReadTimestamp);

      // Lưu local + đẩy Drive NGAY (không debounce) khi bấm Sync
      try {
        localStorage.setItem('reading_history', JSON.stringify(newHistory));
      } catch {}
      await saveReadingHistoryImmediate(newHistory);
      setReadingHistory(newHistory);
      return true;
    } catch (e) {
      console.error("Sync failed", e);
      setError(e instanceof Error ? e.message : 'Sync failed');
      return false;
    }
  }, []);

  useEffect(() => {
  const initializeApp = () => {
    setIsLoading(true);
    const localHistory = getReadingHistory();
    setReadingHistory(localHistory);
setIsLoading(false);

    // KHÔNG await: init xong lúc nào thì cập nhật trạng thái lúc đó
    driveSync.initDriveSync()
      .then(() => setIsDriveReady(true))
      .catch((e: unknown) => {
        console.warn('[Drive] init failed', e);
        setIsDriveReady(false);
      })
      .finally(() => {
        // Dù init có mở popup bị chặn, UI vẫn thoát “Đang tìm…”
        setIsLoading(false);
      });

    const updateAuthStatus = (signedIn: boolean) => {
      setGoogleUser(signedIn ? driveSync.getCurrentUser() : null);
      if (signedIn) {
        handleSync(); // gọi sync chỉ khi đã đăng nhập
      }
    };

    driveSync.listenToAuthChanges(updateAuthStatus);
    updateAuthStatus(driveSync.isSignedIn());
  };

  initializeApp();
}, [handleSync]);


  /** ====== REBUILD state đến đúng chương (ưu tiên cache → Drive), không gọi AI ====== */
  const rebuildForChapter = useCallback(async (storyToLoad: Story, chapterIndex: number) => {
    if (!storyToLoad?.chapters?.length) return {};
    const loaders = [
      // 1) In-memory đã có?
      async (url: string) => {
        if (aiDeltaMem.current.has(url)) return aiDeltaMem.current.get(url);
        return null;
      },
      // 2) Local cache
      async (url: string) => {
        const cached = getCachedChapter(storyToLoad.url, url);
        const stats = cached?.stats ?? null;
        if (stats) aiDeltaMem.current.set(url, stats);
        return stats;
      },
      // 3) Drive
      async (url: string) => {
        if (!driveSync.isSignedIn()) return null;
        const stats = await driveSync.loadChapterAIFromDrive(storyToLoad.url, url);
        if (stats) aiDeltaMem.current.set(url, stats);
        return stats;
      },
    ];

    const base = {}; // có thể lấy snapshot nếu bạn có
    const state = await rebuildStateUpToChapterIndex(storyToLoad.url, storyToLoad.chapters, chapterIndex, loaders, base);
    setCumulativeStats(state);
    stateAtChapterMem.current.set(chapterIndex, state);
    saveStoryStateLocal(storyToLoad.url, state);
    return state;
  }, []);

  // ===== Prefetch content chương kế (content-only, không gọi AI) =====
  const prefetchNextChapter = useCallback(async (storyToLoad: Story, nextIndex: number) => {
    try {
      if (!storyToLoad?.chapters || nextIndex < 0 || nextIndex >= storyToLoad.chapters.length) return;
      const next = storyToLoad.chapters[nextIndex];

      if (driveSync.isSignedIn()) {
        const onDrive = await driveSync.loadChapterFromDrive(storyToLoad.url, next.url);
        if (onDrive) {
          setCachedChapter(storyToLoad.url, next.url, onDrive);
          if (import.meta.env.DEV) console.log('[Prefetch] Drive HIT', next.url);
          return;
        }
        if (import.meta.env.DEV) console.log('[Prefetch] Drive MISS', next.url);
      }

      const local = getCachedChapter(storyToLoad.url, next.url);
      if (local) return;

      const content = await getChapterContent(next, storyToLoad.source);
      setCachedChapter(storyToLoad.url, next.url, { content, stats: null } as any);
      if (import.meta.env.DEV) console.log('[Prefetch] Cached content', next.url);
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[Prefetch] skip', e);
    }
  }, []);

  const fetchChapter = useCallback(async (storyToLoad: Story, chapterIndex: number) => {
    if (!storyToLoad || !storyToLoad.chapters || chapterIndex < 0 || chapterIndex >= storyToLoad.chapters.length) return;

    // Reset trackers khi đổi truyện
    if (lastStoryRef.current !== storyToLoad.url) {
      lastStoryRef.current = storyToLoad.url;
      firstEntryRef.current = true;
      lastIndexRef.current = null;
      stateAtChapterMem.current.clear();
      aiDeltaMem.current.clear();
    }

    const willAnalyzeSequential = shouldAnalyzeSequential(lastIndexRef.current, chapterIndex, firstEntryRef.current);
    if (import.meta.env.DEV) console.log('[Analyze.Decision]', {
      prevIndex: lastIndexRef.current, nextIndex: chapterIndex,
      firstEntry: firstEntryRef.current, willAnalyzeSequential
    });

    const chapter = storyToLoad.chapters[chapterIndex];
    setSelectedChapterIndex(chapterIndex);

    // Update reading history (local + debounced push trong services/history)
    const newHistory = updateReadingHistory(storyToLoad, chapter.url);
    setReadingHistory(newHistory);

    const newReadChapters = new Set(readChapters);
    newReadChapters.add(chapter.url);
    setReadChapters(newReadChapters);
    localStorage.setItem(`readChapters_${storyToLoad.url}`, JSON.stringify(Array.from(newReadChapters)));

    // Nếu đã rebuild state cho chapter này trong phiên → dùng ngay
    if (stateAtChapterMem.current.has(chapterIndex)) {
      setCumulativeStats(stateAtChapterMem.current.get(chapterIndex)!);
    }

    // ===== Drive-first (đúng mục tiêu 3) =====
    let cachedData: { content: string; stats: any | null } | null = null;
    if (driveSync.isSignedIn()) {
      cachedData = await driveSync.loadChapterFromDrive(storyToLoad.url, chapter.url);
      if (cachedData) {
        setCachedChapter(storyToLoad.url, chapter.url, cachedData); // đẩy vào cache local
        if (import.meta.env.DEV) console.log('[DriveFirst] HIT chapter content');
      } else {
        if (import.meta.env.DEV) console.log('[DriveFirst] MISS chapter content');
      }
    }

    // Fallback: Local cache
    if (!cachedData) {
      cachedData = getCachedChapter(storyToLoad.url, chapter.url);
      if (cachedData && import.meta.env.DEV) console.log('[LocalCache] HIT chapter content');
    }

    // Nếu đã có content (cache/Drive) -> hiển thị & REBUILD state đến đúng chương -> không phân tích lại trừ khi sequential và stats rỗng
    if (cachedData) {
      setChapterContent(cachedData.content);

      if (willAnalyzeSequential && (cachedData.stats == null)) {
        try {
          setIsAnalyzing(true);
          const base = await rebuildForChapter(storyToLoad, Math.max(0, chapterIndex - 1));
          const delta = await analyzeChapterForCharacterStats(cachedData.content, base);
          const newState = mergeChapterStats(base, (delta ?? ({} as any)));
          setCumulativeStats(newState);
          stateAtChapterMem.current.set(chapterIndex, newState);
          saveStoryState(storyToLoad.url, newState);

          setCachedChapter(storyToLoad.url, chapter.url, { content: cachedData.content, stats: delta ?? null } as any);
          if (delta) aiDeltaMem.current.set(chapter.url, delta);

          enqueueChapterSync(storyToLoad.url, chapter.url, { content: cachedData.content } as any, delta ?? null);
        } catch (e) {
          console.error('[Analyze on cached content] error', e);
          if (!stateAtChapterMem.current.has(chapterIndex)) {
            await rebuildForChapter(storyToLoad, chapterIndex);
          }
        } finally {
          setIsAnalyzing(false);
        }
      } else {
        if (!stateAtChapterMem.current.has(chapterIndex)) {
          await rebuildForChapter(storyToLoad, chapterIndex);
        }
      }

      // Prefetch i+1 và cập nhật trackers
      prefetchNextChapter(storyToLoad, chapterIndex + 1);
      firstEntryRef.current = false;
      lastIndexRef.current = chapterIndex;
      return;
    }

    // 4) Không có cache/Drive -> tải web
    setIsChapterLoading(true);
    setError(null);
    setChapterContent(null);

    try {
      const content = await getChapterContent(chapter, storyToLoad.source);
      setChapterContent(content);

      // 5) Quyết định có phân tích AI không? (theo quy tắc NHẢY CHƯƠNG KHÔNG PHÂN TÍCH)
      const shouldAnalyze = willAnalyzeSequential;

      if (!shouldAnalyze) {
        // Không phân tích: lưu content-only để đọc/offline, panel sẽ rebuild đến N-1
        setCachedChapter(storyToLoad.url, chapter.url, { content, stats: null } as any);
        await rebuildForChapter(storyToLoad, chapterIndex); // rebuild (sẽ bỏ qua delta của N nếu chưa có)
      } else {
        // 6) Phân tích AI
        setIsAnalyzing(true);
        try {
          // nền đến N-1 trước khi phân tích
          const currentStats = await rebuildForChapter(storyToLoad, Math.max(0, chapterIndex - 1));
          const chapterStats = await analyzeChapterForCharacterStats(content, currentStats);

          const newState = mergeChapterStats(currentStats, chapterStats ?? ({} as any));
          setCumulativeStats(newState);
          stateAtChapterMem.current.set(chapterIndex, newState);
          saveStoryState(storyToLoad.url, newState);

          // Cache content + stats cho nhanh lần sau
          setCachedChapter(storyToLoad.url, chapter.url, { content, stats: chapterStats ?? null } as any);
          if (chapterStats) aiDeltaMem.current.set(chapter.url, chapterStats);

          // ✅ Đẩy qua autosync (tách 2 file: content + AI-per-chapter)
          enqueueChapterSync(
            storyToLoad.url,
            chapter.url,
            { content } as any,
            chapterStats ?? null
          );
        } catch (analysisError) {
          console.error("Analysis error, caching content only", analysisError);
          setCachedChapter(storyToLoad.url, chapter.url, { content, stats: null } as any);
          // Panel vẫn có state đến N-1 nhờ rebuildForChapter ở trên
        } finally {
          setIsAnalyzing(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load chapter content.");
    } finally {
      setIsChapterLoading(false);
      // Prefetch i+1 và cập nhật trackers
      prefetchNextChapter(storyToLoad, chapterIndex + 1);
      firstEntryRef.current = false;
      lastIndexRef.current = chapterIndex;
    }
  }, [readChapters, rebuildForChapter, saveStoryState, prefetchNextChapter]);

  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    setStory(null);
    setSearchResults(null);
    setSelectedChapterIndex(null);
    setChapterContent(null);
    setCumulativeStats(null);
    setReadChapters(new Set());
    try {
      const urlRegex = /^(https?):\/\/[^\s$.?#].[^\s]*$/i;
      if (urlRegex.test(query)) {
        const fullStory = await getStoryFromUrl(query);
        setStory(fullStory);
        let storyState = getStoryState(fullStory.url);
        if (!storyState && driveSync.isSignedIn()) {
            storyState = await driveSync.loadStoryStateFromDrive(fullStory.url);
            if (storyState) saveStoryStateLocal(fullStory.url, storyState);
        }
        setCumulativeStats(storyState ?? {});
        const savedRead = localStorage.getItem(`readChapters_${fullStory.url}`);
        if (savedRead) {
          setReadChapters(new Set(JSON.parse(savedRead)));
        }
      } else {
        const results = await searchStory(query);
        setSearchResults(results);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectStory = useCallback(async (selectedStory: Story) => {
    setIsLoading(true);
    setError(null);
    setSearchResults(null);
    setStory(null);
    try {
        const fullStory = await getStoryDetails(selectedStory);
        setStory(fullStory);

        let storyState = getStoryState(fullStory.url);
        if (!storyState && driveSync.isSignedIn()) {
            storyState = await driveSync.loadStoryStateFromDrive(fullStory.url);
            if (storyState) saveStoryStateLocal(fullStory.url, storyState);
        }
        setCumulativeStats(storyState ?? {});

        const savedRead = localStorage.getItem(`readChapters_${fullStory.url}`);
        if (savedRead) {
            setReadChapters(new Set(JSON.parse(savedRead)));
        } else {
            setReadChapters(new Set());
        }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load story details.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleSelectChapter = useCallback((chapter: Chapter) => {
      if (!story || !story.chapters) return;
      const index = story.chapters.findIndex(c => c.url === chapter.url);
      if (index !== -1) {
          fetchChapter(story, index);
      }
  }, [story, fetchChapter]);

  const handleBackToStory = () => {
    setSelectedChapterIndex(null);
    setChapterContent(null);
    setError(null);
    setIsPanelVisible(false);
  };

  const handlePrevChapter = () => {
    if (story && selectedChapterIndex !== null && selectedChapterIndex > 0) {
        fetchChapter(story, selectedChapterIndex - 1);
    }
  };

  const handleNextChapter = () => {
    if (story && story.chapters && selectedChapterIndex !== null && selectedChapterIndex < story.chapters.length - 1) {
        fetchChapter(story, selectedChapterIndex + 1);
    }
  };

  const handleContinueFromHistory = useCallback(async (item: ReadingHistoryItem) => {
    setIsLoading(true);
    setError(null);
    setSearchResults(null);
    setSelectedChapterIndex(null);
    setChapterContent(null);
    try {
        const storyToLoad: Story = {
            title: item.title, author: item.author, url: item.url,
            source: item.source, imageUrl: item.imageUrl,
        };
        const fullStory = await getStoryDetails(storyToLoad);
        setStory(fullStory);

        let storyState = getStoryState(fullStory.url);
        if (!storyState && driveSync.isSignedIn()) {
            storyState = await driveSync.loadStoryStateFromDrive(fullStory.url);
            if(storyState) saveStoryStateLocal(fullStory.url, storyState);
        }
        setCumulativeStats(storyState ?? {});

        const savedRead = localStorage.getItem(`readChapters_${fullStory.url}`);
        if (savedRead) setReadChapters(new Set(JSON.parse(savedRead)));
        else setReadChapters(new Set());

        const chapterIndex = fullStory.chapters?.findIndex(c => c.url === item.lastChapterUrl);
        if (chapterIndex !== -1) {
            await fetchChapter(fullStory, chapterIndex);
        } else if (fullStory.chapters?.length) {
            await fetchChapter(fullStory, 0);
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load story from history.");
    } finally {
        setIsLoading(false);
    }
  }, [fetchChapter]);

  // ===== Reanalyze current chapter (nút Phân tích lại ở ChapterContent gọi) =====
  const handleReanalyzeCurrent = useCallback(async () => {
    if (!story || selectedChapterIndex == null || !chapterContent) return;
    try {
      setIsAnalyzing(true);
      const base = await rebuildForChapter(story, Math.max(0, selectedChapterIndex - 1));
      const delta = await analyzeChapterForCharacterStats(chapterContent, base);
      const newState = mergeChapterStats(base, (delta ?? ({} as any)));
      setCumulativeStats(newState);
      stateAtChapterMem.current.set(selectedChapterIndex, newState);
      saveStoryState(story.url, newState);

      const curUrl = story.chapters![selectedChapterIndex].url;
      setCachedChapter(story.url, curUrl, { content: chapterContent, stats: delta ?? null } as any);
      if (delta) aiDeltaMem.current.set(curUrl, delta);
      enqueueChapterSync(story.url, curUrl, { content: chapterContent } as any, delta ?? null);
    } catch (e) {
      console.error('[Reanalyze] error', e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [story, selectedChapterIndex, chapterContent, rebuildForChapter, saveStoryState]);

  const renderMainContent = () => {
    if (isLoading && !isDriveReady) return <LoadingSpinner />;

    if (error && !story && !searchResults && !isChapterLoading) {
      return (
        <div className="text-center p-4 bg-rose-900/50 border border-rose-700 rounded-lg">
            <p className="text-rose-300 font-semibold">An error occurred</p>
            <p className="text-rose-400 mt-2">{error}</p>
        </div>
      );
    }

    if (selectedChapterIndex !== null && story && story.chapters) {
        if (isChapterLoading && !chapterContent) return <LoadingSpinner />;
        if (error) {
             return (
                <div className="text-center p-4 bg-rose-900/50 border border-rose-700 rounded-lg">
                    <p className="text-rose-300 font-semibold">Could not load chapter</p>
                    <p className="text-rose-400 mt-2">{error}</p>
                    <button onClick={handleBackToStory} className="mt-4 bg-[var(--theme-accent-primary)] hover:brightness-90 text-white font-bold py-2 px-4 rounded-lg">Go Back</button>
                </div>
            );
        }
        if (chapterContent) {
            return (
                <ChapterContent
                  story={story} currentChapterIndex={selectedChapterIndex} content={chapterContent}
                  onBack={handleBackToStory} onPrev={handlePrevChapter} onNext={handleNextChapter}
                  onSelectChapter={handleSelectChapter} readChapters={readChapters} settings={settings}
                  onSettingsChange={setSettings} onNavBarVisibilityChange={setIsBottomNavForReadingVisible}
                  cumulativeStats={cumulativeStats}
                  onReanalyze={handleReanalyzeCurrent}
                />
            );
        }
         return <LoadingSpinner />;
    }

    if (story) return <StoryDetail story={story} onSelectChapter={handleSelectChapter} readChapters={readChapters} lastReadChapterIndex={selectedChapterIndex} />;
    if (searchResults) return <SearchResultsList results={searchResults} onSelectStory={handleSelectStory} />;
    if (readingHistory.length > 0) return <ReadingHistory items={readingHistory} onContinue={handleContinueFromHistory} />;

    return (
        <div className="text-center text-[var(--theme-text-secondary)]">
            <h2 className="text-2xl mb-4 text-[var(--theme-text-primary)]">Chào mừng đến với Trình Đọc Truyện</h2>
            <p>Sử dụng thanh tìm kiếm ở trên để tìm truyện bạn muốn đọc.</p>
        </div>
    );
  };

  const isReading = selectedChapterIndex !== null && !!story && !!chapterContent;
  const mainContainerClass = isReading
    ? "w-full px-4 sm:px-8 py-8 sm:py-12 flex-grow"
    : "max-w-screen-2xl mx-auto px-4 py-8 sm:py-12 flex-grow";


  useEffect(() => {
    driveSync.initDriveSync().catch(console.error);
    initAutosync();
  }, []);



  return (
    <div className="bg-[var(--theme-bg-base)] text-[var(--theme-text-primary)] min-h-screen flex flex-col">
      <Header onOpenSync={() => setIsSyncModalOpen(true)} user={googleUser} />
      <main className={mainContainerClass}>
        <div className="mb-8">
            <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {isReading ? (
          <div className="grid grid-cols-1 lg:grid-cols-[24rem_minmax(0,1fr)_24rem] xl:grid-cols-[28rem_minmax(0,1fr)_28rem] lg:gap-8">
            <aside className="hidden lg:block sticky top-8 self-start">
              <CharacterPrimaryPanel stats={cumulativeStats} isAnalyzing={isAnalyzing} />
            </aside>
            <div className="min-w-0">{renderMainContent()}</div>
            <aside className="hidden lg:block sticky top-8 self-start">
              <CharacterPanel stats={cumulativeStats} isAnalyzing={isAnalyzing} isOpen={true} onClose={() => {}} isSidebar={true} />
            </aside>
          </div>
        ) : (
          <div>{renderMainContent()}</div>
        )}

      </main>
      {!isReading && <Footer />}

      <div className="lg:hidden">
          {isReading && (
            <>
                <PanelToggleButton onClick={() => setIsPanelVisible(!isPanelVisible)} isPanelOpen={isPanelVisible} isBottomNavVisible={isBottomNavForReadingVisible} />
                <CharacterPanel isOpen={isPanelVisible} onClose={() => setIsPanelVisible(false)} stats={cumulativeStats} isAnalyzing={isAnalyzing} isSidebar={false} />
            </>
          )}
      </div>
      <ScrollToTopButton isReading={isReading} isBottomNavVisible={isBottomNavForReadingVisible} />
      {isSyncModalOpen && <SyncModal onClose={() => setIsSyncModalOpen(false)} onSync={handleSync} />}
    </div>
  );
};

export default App;