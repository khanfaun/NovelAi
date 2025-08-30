import React, { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSearch} className="w-full max-w-2xl mx-auto">
      <div className="flex items-center border-b-2 border-[var(--theme-accent-primary)] py-2">
        <input
          className="appearance-none bg-transparent border-none w-full text-[var(--theme-text-primary)] mr-3 py-1 px-2 leading-tight focus:outline-none"
          type="text"
          placeholder="Nhập tên truyện hoặc dán URL..."
          aria-label="Tên truyện hoặc URL"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
        />
        <button
          className="flex-shrink-0 bg-[var(--theme-accent-primary)] hover:brightness-90 border-[var(--theme-accent-primary)] hover:border-[var(--theme-accent-primary)]/90 text-sm border-4 text-white py-1 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-300"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Đang tìm...' : 'Tìm kiếm'}
        </button>
      </div>
    </form>
  );
};

export default SearchBar;