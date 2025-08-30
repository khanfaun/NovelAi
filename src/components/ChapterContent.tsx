import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Story, Chapter, ReadingSettings, CharacterStats, CachedChapter } from '@/types';
import ChapterListModal from './ChapterListModal';
import SettingsPanel from './SettingsPanel';
import EntityTooltip from './EntityTooltip';
import { saveChapterAIToDrive, loadChapterAIFromDrive } from '@/services/sync'
import { enqueueChapterSync } from '@/services/autosync';

interface ChapterContentProps {
  story: Story;
  currentChapterIndex: number;
  content: string;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSelectChapter: (chapter: Chapter) => void;
  readChapters: Set<string>;
  settings: ReadingSettings;
  onSettingsChange: (settings: ReadingSettings) => void;
  onNavBarVisibilityChange: (isVisible: boolean) => void;
  cumulativeStats: CharacterStats | null;
  /** Thêm theo yêu cầu: nút Phân tích lại sẽ gọi prop này nếu có */
  onReanalyze?: () => void;
}

const ChapterContent: React.FC<ChapterContentProps> = ({ story, currentChapterIndex, content, onBack, onPrev, onNext, onSelectChapter, readChapters, settings, onSettingsChange, onNavBarVisibilityChange, cumulativeStats, onReanalyze }) => {
  // URL của truyện
  const storyUrl = story?.url;

  // Lấy chapter hiện tại từ index
  const currentChapter = useMemo(
    () => story?.chapters?.[currentChapterIndex] ?? null,
    [story, currentChapterIndex]
  );

  // URL của chương hiện tại
  const chapterUrl = currentChapter?.url || null;

  // Gói dữ liệu chương theo đúng type CachedChapter
  const chapterData: CachedChapter = useMemo(
    () => ({ content, stats: cumulativeStats ?? null }),
    [content, cumulativeStats]
  );

  const [isListVisible, setIsListVisible] = useState(false);
  const [isNavBarVisible, setIsNavBarVisible] = useState(true);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const lastScrollY = useRef(0);

  // State cho chức năng tự động cuộn
  const [popoverTarget, setPopoverTarget] = useState<'top' | 'bottom' | null>(null);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(1); // Tốc độ mặc định từ 0-10, đổi về 1
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const scrollIntervalRef = useRef<number | null>(null);
  const autoScrollButtonRefTop = useRef<HTMLDivElement>(null);
  const autoScrollButtonRefBottom = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onNavBarVisibilityChange(isNavBarVisible);
  }, [isNavBarVisible, onNavBarVisibilityChange]);

  const chapterTitle = story.chapters?.[currentChapterIndex]?.title ?? 'Đang tải...';
  const isFirstChapter = currentChapterIndex === 0;
  const isLastChapter = !story.chapters || currentChapterIndex === story.chapters.length - 1;

  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
        cancelAnimationFrame(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
    }
    setIsAutoScrolling(false);
  }, []);

  const startAutoScroll = useCallback(() => {
    setPopoverTarget(null); // Đóng popover khi bắt đầu cuộn

    if (autoScrollSpeed === 0) {
        stopAutoScroll();
        return;
    }

    setIsAutoScrolling(true);

    let frameCount = 0;
    // Cơ chế mới để làm chậm tốc độ cuộn:
    // Tốc độ 10 là nhanh nhất (bỏ qua 1 frame giữa mỗi lần cuộn 1px).
    // Tốc độ 1 là chậm nhất (bỏ qua 10 frames giữa mỗi lần cuộn 1px).
    // Điều này tạo ra chuyển động rất chậm và mượt mà, giải quyết vấn đề tốc độ 1, 2 không hoạt động.
    const framesToSkip = 11 - autoScrollSpeed;

    const scrollStep = () => {
      frameCount++;
      // Chỉ cuộn khi bộ đếm frame đạt đến ngưỡng
      if (frameCount >= framesToSkip) {
        window.scrollBy(0, 1); // Luôn cuộn 1px để đảm bảo chuyển động mượt và nhất quán
        frameCount = 0; // Đặt lại bộ đếm
      }

      // Kiểm tra nếu đã cuộn đến cuối trang
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) { // Thêm lề nhỏ
        stopAutoScroll();
      } else {
        scrollIntervalRef.current = requestAnimationFrame(scrollStep);
      }
    };

    // Xóa frame animation cũ trước khi bắt đầu một frame mới
    if (scrollIntervalRef.current) {
        cancelAnimationFrame(scrollIntervalRef.current);
    }
    scrollIntervalRef.current = requestAnimationFrame(scrollStep);
  }, [autoScrollSpeed, stopAutoScroll]);

  // Dừng tự động cuộn khi người dùng cuộn thủ công
  useEffect(() => {
    const handleManualScroll = () => {
      if (isAutoScrolling) {
        stopAutoScroll();
      }
    };
    window.addEventListener('wheel', handleManualScroll);
    window.addEventListener('touchstart', handleManualScroll);

    return () => {
      window.removeEventListener('wheel', handleManualScroll);
      window.removeEventListener('touchstart', handleManualScroll);
    };
  }, [isAutoScrolling, stopAutoScroll]);

  // Dừng cuộn khi chuyển chương hoặc quay lại
  useEffect(() => {
    return () => {
      stopAutoScroll();
    };
  }, [currentChapterIndex, stopAutoScroll]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollThreshold = 10;
      const bottomOffset = 50;

      const isAtBottom = window.innerHeight + currentScrollY >= document.documentElement.scrollHeight - bottomOffset;

      if (isAtBottom) {
        setIsNavBarVisible(true);
      } else {
        if (Math.abs(currentScrollY - lastScrollY.current) < scrollThreshold) {
          return;
        }
        if (currentScrollY < lastScrollY.current || currentScrollY < 100) {
          setIsNavBarVisible(true);
        } else {
          setIsNavBarVisible(false);
        }
      }
      lastScrollY.current = currentScrollY <= 0 ? 0 : currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleChapterSelectAndClose = (chapter: Chapter) => {
    onSelectChapter(chapter);
    setIsListVisible(false);
  };

  const handleAutoScrollButtonClick = (target: 'top' | 'bottom') => {
      if (isAutoScrolling) {
          stopAutoScroll();
      } else {
          setPopoverTarget(prev => (prev === target ? null : target));
      }
  };

  const entityMapData = useMemo(() => {
    if (!cumulativeStats) return { map: new Map(), regex: null };

    const map = new Map<string, any>();
    const allNames: string[] = [];

    const addEntity = (entity: any) => {
        if (entity && entity.ten && typeof entity.ten === 'string' && entity.ten.trim().length > 1) {
            const trimmedName = entity.ten.trim();
            if (!map.has(trimmedName.toLowerCase())) {
                map.set(trimmedName.toLowerCase(), entity);
                allNames.push(trimmedName);
            }
        }
    };

    const addEntities = (entityArray: any[] | undefined) => {
        if (entityArray) {
            entityArray.forEach(addEntity);
        }
    };

    const mainChar = cumulativeStats.trangThai?.ten;
    if (mainChar && mainChar.trim()) {
        const charEntity = {
            ten: mainChar.trim(),
            moTa: `Nhân vật chính. Cảnh giới hiện tại: ${cumulativeStats.canhGioi || 'Chưa rõ'}`
        };
        addEntity(charEntity);
    }

    addEntities(cumulativeStats.trangThai?.tuChat);
    addEntities(cumulativeStats.balo);
    addEntities(cumulativeStats.congPhap);
    addEntities(cumulativeStats.trangBi);
    addEntities(cumulativeStats.npcs);
    addEntities(cumulativeStats.theLuc);
    addEntities(cumulativeStats.diaDiem);

    if (allNames.length === 0) return { map, regex: null };

    allNames.sort((a, b) => b.length - a.length);

    const escapedNames = allNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    const regex = new RegExp(`(${escapedNames.join('|')})`, 'gi');

    return { map, regex };
  }, [cumulativeStats]);

  const renderContentWithTooltips = useCallback((text: string) => {
    const { map, regex } = entityMapData;
    if (!regex || map.size === 0) {
        return text.split('\\n').map((paragraph, index) => (
            <p key={index} className="mb-4">{paragraph}</p>
        ));
    }

    return text.split('\\n').map((paragraph, pIndex) => {
        if (!paragraph.trim()) return <p key={pIndex} className="mb-4" />;

        const parts = paragraph.split(regex);

        return (
            <p key={pIndex} className="mb-4">
                {parts.map((part, index) => {
                    // Even indices are text, odd are matches
                    if (index % 2 === 1) {
                        const entity = map.get(part.toLowerCase());
                        if (entity) {
                            return (
                                <EntityTooltip key={index} entity={entity}>
                                    {part}
                                </EntityTooltip>
                            );
                        }
                    }
                    return <React.Fragment key={index}>{part}</React.Fragment>;
                })}
            </p>
        );
    });
  }, [entityMapData]);

  const autoScrollPopover = (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center animate-fade-in"
      onClick={() => setPopoverTarget(null)}
    >
      <div
        ref={popoverRef}
        onClick={e => e.stopPropagation()}
        className="w-64 bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg shadow-xl p-4 animate-fade-in-up"
      >
        <label htmlFor="scrollSpeed" className="block text-sm font-medium text-[var(--theme-text-secondary)] mb-2">
          Tốc độ cuộn: <span className="font-bold text-[var(--theme-accent-primary)]">{autoScrollSpeed}</span>
        </label>
        <input
          id="scrollSpeed"
          type="range"
          min="0"
          max="10"
          value={autoScrollSpeed}
          onChange={e => setAutoScrollSpeed(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-[var(--theme-bg-base)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-accent-primary)]"
        />
        <button
          onClick={startAutoScroll}
          className="w-full mt-4 bg-[var(--theme-accent-primary)] hover:brightness-90 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
        >
          {autoScrollSpeed === 0 ? 'Dừng cuộn' : 'Bắt đầu cuộn'}
        </button>
      </div>
    </div>
  );

  const navButtons = (target: 'top' | 'bottom') => {
    const ref = target === 'top' ? autoScrollButtonRefTop : autoScrollButtonRefBottom;
    return (
        <div className="container mx-auto px-4 flex justify-center items-center gap-2 sm:gap-4 flex-wrap">
          <button onClick={onPrev} disabled={isFirstChapter} className="bg-[var(--theme-bg-surface)] brightness-125 hover:brightness-150 text-[var(--theme-text-primary)] font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">Chương trước</button>
          <button onClick={() => setIsListVisible(true)} className="bg-[var(--theme-text-primary)] text-[var(--theme-bg-surface)] hover:brightness-90 font-bold py-2 px-4 rounded-lg transition-all duration-300">Danh sách chương</button>
          <button onClick={onNext} disabled={isLastChapter} className="bg-[var(--theme-bg-surface)] brightness-125 hover:brightness-150 text-[var(--theme-text-primary)] font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">Chương sau</button>
          <button onClick={() => setIsSettingsVisible(true)} className="bg-[var(--theme-bg-surface)] brightness-125 hover:brightness-150 text-[var(--theme-text-primary)] p-2 rounded-lg transition-all duration-300" aria-label="Tùy chỉnh hiển thị">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065 2.572c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.065-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {/* Nút Phân tích lại: chỉ thêm, không xóa/thay đổi logic cũ */}
          <button
            onClick={() => {
              if (window.confirm('Phân tích lại chương này? (Chỉ ghi _ai/chuong-X.ai.json, không đụng file content)')) {
                onReanalyze && onReanalyze();
              }
            }}
            className="bg-[var(--theme-bg-surface)] brightness-125 hover:brightness-150 text-[var(--theme-text-primary)] font-bold py-2 px-4 rounded-lg transition-all duration-300"
          >
            Phân tích lại
          </button>
          {/* Nút tự động cuộn và popover */}
          <div ref={ref} className="relative">
            <button
                onClick={() => handleAutoScrollButtonClick(target)}
                className={`p-2 rounded-lg transition-all duration-300 ${isAutoScrolling ? 'bg-[var(--theme-accent-primary)] text-white' : 'bg-[var(--theme-bg-surface)] brightness-125 hover:brightness-150 text-[var(--theme-text-primary)]'}`}
                aria-label={isAutoScrolling ? "Dừng cuộn" : "Bắt đầu cuộn tự động"}
                >
                {isAutoScrolling ? (
                    // Pause Icon
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ) : (
                    // Play/Scroll Icon
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
                    </svg>
                )}
            </button>
          </div>
        </div>
      );
    };

  // Các biến ví dụ (đổi theo tên thực tế của bạn):
  // storyUrl: string
  // chapterUrl: string
  // chapterData: CachedChapter          // nội dung chương đang render
  // aiStats: CharacterStats | null      // dữ liệu AI theo chương (nếu có)

  return (
    <>
      <div className="bg-[var(--reader-bg)] rounded-lg shadow-xl p-4 sm:p-8 lg:p-12 w-full animate-fade-in border border-[var(--theme-border)] pb-24">
        <button
          onClick={onBack}
          className="mb-6 bg-[var(--theme-accent-primary)] hover:brightness-90 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
        >
          &larr; Quay lại danh sách chương
        </button>

        <h2 className="text-3xl font-bold text-center text-[var(--reader-title)] mb-4">{chapterTitle}</h2>

        <div className="py-4 border-y border-[var(--theme-border)]">
          {navButtons('top')}
        </div>

        <div
          className="prose max-w-none text-justify mt-6"
          style={{
              minHeight: '50vh',
              color: 'var(--reader-text)',
              fontSize: 'var(--reader-font-size)',
              fontFamily: 'var(--reader-font-family)',
              lineHeight: 1.8,
          }}
        >
          {renderContentWithTooltips(content)}
        </div>
      </div>

      {popoverTarget && autoScrollPopover}

      <div className={`fixed bottom-0 left-0 right-0 z-10 py-4 bg-[var(--theme-bg-base)]/95 backdrop-blur-lg border-t border-[var(--theme-border)] shadow-lg transition-transform duration-300 ${isNavBarVisible ? 'translate-y-0' : 'translate-y-full'}`}>
        {navButtons('bottom')}
      </div>

      <ChapterListModal
        isOpen={isListVisible}
        onClose={() => setIsListVisible(false)}
        chapters={story.chapters ?? []}
        currentChapterUrl={story.chapters?.[currentChapterIndex]?.url}
        onSelectChapter={handleChapterSelectAndClose}
        readChapters={readChapters}
      />

      <SettingsPanel
        isOpen={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        settings={settings}
        onSettingsChange={onSettingsChange}
      />
    </>
  );
};

export default ChapterContent;