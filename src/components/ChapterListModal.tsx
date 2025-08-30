import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Chapter } from '@/types';

interface ChapterListModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: Chapter[];
  currentChapterUrl?: string;
  onSelectChapter: (chapter: Chapter) => void;
  readChapters: Set<string>;
}

const ChapterListModal: React.FC<ChapterListModalProps> = ({ isOpen, onClose, chapters, currentChapterUrl, onSelectChapter, readChapters }) => {
  const [filter, setFilter] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const filteredChapters = useMemo(() => {
    if (!filter.trim()) {
      return chapters;
    }
    const lowercasedFilter = filter.toLowerCase();
    return chapters.filter(chapter =>
      chapter.title.toLowerCase().includes(lowercasedFilter)
    );
  }, [chapters, filter]);


  useEffect(() => {
    if (isOpen) {
      // Reset filter when opened
      setFilter('');
      
      // Scroll to current chapter
      setTimeout(() => {
          if (currentChapterUrl) {
            const element = listRef.current?.querySelector(`[data-url="${currentChapterUrl}"]`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }, 100);
    }
  }, [isOpen, chapters, currentChapterUrl]);
  

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center" onClick={onClose}>
      <div
        className="bg-[var(--theme-bg-surface)] rounded-lg shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col m-4 border border-[var(--theme-border)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-[var(--theme-border)] sticky top-0 bg-[var(--theme-bg-surface)]">
          <h2 className="text-xl font-bold text-[var(--theme-text-primary)]">Danh sách chương ({filteredChapters.length}/{chapters.length})</h2>
          <button onClick={onClose} className="text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] text-3xl leading-none">&times;</button>
        </div>
        
        <div className="p-4">
             <input
                type="text"
                placeholder="Tìm chương..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="w-full bg-[var(--theme-bg-base)] border border-[var(--theme-border)] rounded-md p-2 text-[var(--theme-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent-primary)]"
            />
        </div>

        <div className="overflow-y-auto flex-grow p-4" ref={listRef}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredChapters.map(chapter => {
              const isCurrent = chapter.url === currentChapterUrl;
              const isRead = readChapters.has(chapter.url);
              
              let buttonClass = 'text-left p-3 rounded-md hover:bg-[var(--theme-accent-primary)] hover:text-white transition-colors duration-200 text-sm truncate';
              if (isCurrent) {
                  buttonClass += ' ring-2 ring-[var(--theme-accent-primary)] bg-[var(--theme-accent-primary)]/20 text-[var(--theme-accent-primary)]';
              } else if (isRead) {
                  buttonClass += ' bg-[var(--theme-bg-base)] text-[var(--theme-text-secondary)] border border-[var(--theme-border)]';
              } else {
                  buttonClass += ' bg-[var(--theme-bg-surface)] brightness-110 text-[var(--theme-text-secondary)]';
              }

              return (
                <button
                  key={chapter.url}
                  data-url={chapter.url}
                  onClick={() => onSelectChapter(chapter)}
                  className={buttonClass}
                >
                  {chapter.title}
                </button>
              );
            })}
             {filteredChapters.length === 0 && (
                <p className="text-[var(--theme-text-secondary)] col-span-full text-center">Không tìm thấy chương nào.</p>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default ChapterListModal;