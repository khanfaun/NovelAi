import React, { useState } from 'react';
import type { Story, Chapter } from '@/types';

interface StoryDetailProps {
  story: Story;
  onSelectChapter: (chapter: Chapter) => void;
  readChapters: Set<string>;
  lastReadChapterIndex: number | null;
}

const StoryDetail: React.FC<StoryDetailProps> = ({ story, onSelectChapter, readChapters, lastReadChapterIndex }) => {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const chaptersPerPage = 100; // Hiển thị 100 chương mỗi trang

  // Pagination logic
  const totalChapters = story.chapters?.length ?? 0;
  const totalPages = Math.ceil(totalChapters / chaptersPerPage);
  const indexOfLastChapter = currentPage * chaptersPerPage;
  const indexOfFirstChapter = indexOfLastChapter - chaptersPerPage;
  const currentChapters = story.chapters?.slice(indexOfFirstChapter, indexOfLastChapter) ?? [];
  
  const handlePageChange = (pageNumber: number) => {
    const newPage = Math.max(1, Math.min(pageNumber, totalPages));
    setCurrentPage(newPage);
  };

  return (
    <div className="bg-[var(--theme-bg-surface)] rounded-lg shadow-xl p-6 animate-fade-in border border-[var(--theme-border)]">
      {/* Story info without image */}
      <div className="mb-6">
          <h2 className="text-3xl font-bold text-[var(--theme-text-primary)] mb-2">{story.title}</h2>
          <p className="text-[var(--theme-accent-primary)] mb-1">Tác giả: {story.author}</p>
          <p className="text-[var(--theme-text-secondary)] text-sm mb-4">Nguồn: {story.source}</p>
          <p className="text-[var(--theme-text-primary)] leading-relaxed">{story.description}</p>
      </div>

      <div className="mt-8">
        <h3 className="text-2xl font-semibold text-[var(--theme-text-primary)] border-b-2 border-[var(--theme-border)] pb-2 mb-4">Danh sách chương ({totalChapters})</h3>
        
        {/* Chapter list with paginated data */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {currentChapters.map((chapter) => {
            const isRead = readChapters.has(chapter.url);
            const lastReadChapterUrl = story.chapters[lastReadChapterIndex ?? -1]?.url;
            const isLastRead = lastReadChapterUrl === chapter.url;

            let buttonClass = 'text-left p-3 rounded-md hover:bg-[var(--theme-accent-primary)] hover:text-white transition-colors duration-200 text-sm truncate';
            if (isLastRead) {
                buttonClass += ' ring-2 ring-[var(--theme-accent-primary)] bg-[var(--theme-accent-primary)]/20 text-[var(--theme-accent-primary)]';
            } else if (isRead) {
                buttonClass += ' bg-[var(--theme-bg-base)] text-[var(--theme-text-secondary)] border border-[var(--theme-border)]';
            } else {
                buttonClass += ' bg-[var(--theme-bg-surface)] brightness-110 text-[var(--theme-text-secondary)]';
            }

            return (
              <button
                key={chapter.url}
                onClick={() => onSelectChapter(chapter)}
                className={buttonClass}
              >
                {chapter.title}
              </button>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 sm:gap-4 flex-wrap mt-8">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="bg-[var(--theme-bg-surface)] brightness-125 hover:brightness-150 text-[var(--theme-text-primary)] font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &laquo; Đầu
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="bg-[var(--theme-bg-surface)] brightness-125 hover:brightness-150 text-[var(--theme-text-primary)] font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &lsaquo; Trước
            </button>
            <span className="text-[var(--theme-text-primary)] font-semibold whitespace-nowrap">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="bg-[var(--theme-bg-surface)] brightness-125 hover:brightness-150 text-[var(--theme-text-primary)] font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sau &rsaquo;
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="bg-[var(--theme-bg-surface)] brightness-125 hover:brightness-150 text-[var(--theme-text-primary)] font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cuối &raquo;
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryDetail;