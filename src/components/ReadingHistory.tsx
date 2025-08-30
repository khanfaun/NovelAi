import React from 'react';
import type { ReadingHistoryItem } from '@/types';
import { BookOpenIcon } from './icons';

interface ReadingHistoryProps {
  items: ReadingHistoryItem[];
  onContinue: (item: ReadingHistoryItem) => void;
}

const ReadingHistory: React.FC<ReadingHistoryProps> = ({ items, onContinue }) => {
  if (!items || items.length === 0) {
    return null;
  }
  
  const getChapterNumberFromUrl = (url: string): string => {
    const match = url.match(/chuong-(\d+)/i);
    return match ? `Chương ${match[1]}` : 'Chương đang đọc';
  };

  return (
    <div className="reading-history animate-fade-in">
      <h2 className="reading-history__title">Tiếp tục đọc</h2>
      <ul>
        {items.map((item) => (
          <li key={item.url}>
            <button
              onClick={() => onContinue(item)}
              className="reading-history__item-button"
              aria-label={`Tiếp tục đọc ${item.title}`}
            >
                <BookOpenIcon className="reading-history__item-icon" />
                <div className="reading-history__item-info">
                    <h3 className="reading-history__item-title" title={item.title}>{item.title}</h3>
                    <p className="reading-history__item-author">{item.author}</p>
                    <p className="reading-history__item-chapter">
                        Đọc tiếp: {getChapterNumberFromUrl(item.lastChapterUrl)}
                    </p>
                </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ReadingHistory;
