// src/services/history.ts
import type { ReadingHistoryItem, Story } from '@/types';
import * as driveSync from './sync';

const LS_KEY = 'reading_history';

export function getReadingHistory(): ReadingHistoryItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ReadingHistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveReadingHistoryLocal(items: ReadingHistoryItem[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('saveReadingHistoryLocal failed', e);
  }
}

async function pushHistoryToDrive(items: ReadingHistoryItem[]): Promise<void> {
  if (!driveSync.isSignedIn()) return;
  try {
    await driveSync.saveHistoryToDrive(items);
  } catch (e) {
    console.warn('pushHistoryToDrive failed', e);
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
export function saveReadingHistoryDebounced(items: ReadingHistoryItem[], delayMs = 5000): void {
  saveReadingHistoryLocal(items);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    pushHistoryToDrive(items);
  }, delayMs);
}

export async function saveReadingHistoryImmediate(items: ReadingHistoryItem[]): Promise<void> {
  saveReadingHistoryLocal(items);
  await pushHistoryToDrive(items);
}

/**
 * Cập nhật mục lịch sử cho một truyện khi người dùng mở chương mới.
 * - Trả về danh sách mới (đã lưu local và debounced push lên Drive).
 */
export function updateReadingHistory(story: Story, chapterUrl: string): ReadingHistoryItem[] {
  const items = getReadingHistory();
  const now = Date.now();

  const idx = items.findIndex(i => i.url === story.url);
  const entry: ReadingHistoryItem = {
    url: story.url,
    title: story.title,
    author: story.author,
    imageUrl: (story as any).imageUrl,
    source: (story as any).source,
    lastChapterUrl: chapterUrl,
    lastReadTimestamp: now,
  };

  if (idx >= 0) {
    items[idx] = entry;
  } else {
    items.unshift(entry);
  }

  // giữ unique theo url, ưu tiên item mới nhất
  const seen = new Set<string>();
  const dedup: ReadingHistoryItem[] = [];
  for (const it of items.sort((a, b) => b.lastReadTimestamp - a.lastReadTimestamp)) {
    if (!seen.has(it.url)) {
      seen.add(it.url);
      dedup.push(it);
    }
  }

  // Lưu local + đẩy Drive (debounced) để tránh spam request
  saveReadingHistoryDebounced(dedup);
  return dedup;
}
