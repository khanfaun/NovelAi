import React from 'react';
import type { Story } from '@/types';

interface SearchResultItemProps {
  story: Story;
  onSelectStory: (story: Story) => void;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({ story, onSelectStory }) => {
  let sourceColor: string;
  switch (story.source) {
      case 'TruyenFull.vn':
          sourceColor = 'bg-teal-800 text-teal-300';
          break;
      case 'TruyenFull.vision':
          sourceColor = 'bg-indigo-800 text-indigo-300';
          break;
      case 'TangThuVien.net':
          sourceColor = 'bg-orange-800 text-orange-300';
          break;
      case 'TruyenHDT.com':
          sourceColor = 'bg-rose-800 text-rose-300';
          break;
      case 'KhoDocSach.com':
          sourceColor = 'bg-amber-800 text-amber-300';
          break;
      case 'TruyenYY.mobi':
          sourceColor = 'bg-fuchsia-800 text-fuchsia-300';
          break;
      case 'MetruyenCV.com':
          sourceColor = 'bg-emerald-800 text-emerald-300';
          break;
      default:
          sourceColor = 'bg-slate-700 text-slate-300';
          break;
  }
    
  return (
    <div 
      className="bg-[var(--theme-bg-surface)] rounded-lg shadow-lg overflow-hidden flex flex-col cursor-pointer transition-transform transform hover:scale-105 hover:shadow-[var(--theme-accent-primary)]/20"
      onClick={() => onSelectStory(story)}
      role="button"
      tabIndex={0}
      aria-label={`Chọn truyện ${story.title}`}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectStory(story)}
    >
      <div className="relative pt-[140%] bg-slate-700">
        <img 
          src={story.imageUrl} 
          alt={`Bìa truyện ${story.title}`} 
          className="absolute top-0 left-0 w-full h-full object-cover" 
          loading="lazy"
        />
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-md font-bold text-[var(--theme-text-primary)] leading-tight mb-1 flex-grow" title={story.title}>
          {story.title}
        </h3>
        <p className="text-sm text-[var(--theme-text-secondary)] mb-3 truncate">{story.author}</p>
        <div className="text-right mt-auto">
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${sourceColor}`}>
            {story.source}
          </span>
        </div>
      </div>
    </div>
  );
};

interface SearchResultsListProps {
  results: Story[];
  onSelectStory: (story: Story) => void;
}

const SearchResultsList: React.FC<SearchResultsListProps> = ({ results, onSelectStory }) => {
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-[var(--theme-text-primary)] mb-6 border-b-2 border-[var(--theme-border)] pb-2">Kết quả tìm kiếm ({results.length})</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
        {results.map((story) => (
          <SearchResultItem key={story.url} story={story} onSelectStory={onSelectStory} />
        ))}
      </div>
    </div>
  );
};

export default SearchResultsList;