// src/services/storyStateService.ts
import type { CharacterStats } from '@/types';

/** ===== Local storage helpers ===== */
const LS_KEY = (storyUrl: string) => `story_state_${storyUrl}`;

export function getStoryState(storyUrl: string): CharacterStats | null {
  try {
    const raw = localStorage.getItem(LS_KEY(storyUrl));
    return raw ? (JSON.parse(raw) as CharacterStats) : null;
  } catch {
    return null;
  }
}

export function saveStoryState(storyUrl: string, state: CharacterStats): void {
  try {
    localStorage.setItem(LS_KEY(storyUrl), JSON.stringify(state));
  } catch (e) {
    console.error('saveStoryState failed', e);
  }
}

export function clearStoryState(storyUrl: string): void {
  try {
    localStorage.removeItem(LS_KEY(storyUrl));
  } catch {}
}

/** ===== Merge helpers (array merge by key) ===== */
type AnyObj = Record<string, any>;

function pickKey(obj: AnyObj): string | null {
  if (!obj || typeof obj !== 'object') return null;
  if ('ten' in obj) return 'ten';
  if ('name' in obj) return 'name';
  if ('id' in obj) return 'id';
  return null;
}

function mergeArraysByKey(a: any[], b: any[]): any[] {
  const out: any[] = Array.isArray(a) ? [...a] : [];
  const add: any[] = Array.isArray(b) ? b : [];
  if (!add.length) return out;

  const key = pickKey(add[0]) || pickKey(out[0]);
  if (!key) {
    // fallback: unique by JSON string
    const seen = new Set(out.map((x) => JSON.stringify(x)));
    for (const item of add) {
      const sig = JSON.stringify(item);
      if (!seen.has(sig)) {
        out.push(item);
        seen.add(sig);
      }
    }
    return out;
  }

  const idx = new Map<string, number>();
  out.forEach((item, i) => idx.set(String(item?.[key]), i));

  for (const item of add) {
    const k = String(item?.[key]);
    if (!idx.has(k)) {
      idx.set(k, out.length);
      out.push(item);
    } else {
      const i = idx.get(k)!;
      out[i] = deepMerge(out[i], item);
    }
  }
  return out;
}

function deepMerge(a: any, b: any): any {
  if (Array.isArray(a) && Array.isArray(b)) return mergeArraysByKey(a, b);
  if (Array.isArray(a) && !Array.isArray(b)) return a;
  if (!Array.isArray(a) && Array.isArray(b)) return b;

  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const out: AnyObj = { ...a };
    for (const k of Object.keys(b)) {
      if (k in a) out[k] = deepMerge(a[k], b[k]);
      else out[k] = b[k];
    }
    return out;
  }
  return b ?? a;
}

/** ===== Public merge API ===== */
export function mergeChapterStats(base: CharacterStats, delta: Partial<CharacterStats>): CharacterStats {
  if (!delta || typeof delta !== 'object') return base || {};
  const result = deepMerge(base || {}, delta);
  return result;
}

/**
 * Rebuild state up to a target chapter index using per-chapter AI deltas.
 * - Không gọi AI; chỉ đọc delta đã lưu (Drive hoặc cache).
 * - loaders: danh sách loader theo thứ tự ưu tiên. Loader trả về null nếu không có file.
 * - Tối ưu: tải song song rồi merge theo thứ tự chương.
 */
export async function rebuildStateUpToChapterIndex(
  storyUrl: string,
  chapters: { url: string }[],
  targetIndex: number,
  loaders: Array<(chapterUrl: string) => Promise<Partial<CharacterStats> | null>>,
  baseState?: CharacterStats
): Promise<CharacterStats> {
  const safeIndex = Math.max(0, Math.min(targetIndex, (chapters?.length || 1) - 1));
  const urls = chapters.slice(0, safeIndex + 1).map(c => c.url);
  let state: CharacterStats = baseState ? JSON.parse(JSON.stringify(baseState)) : {};

  async function loadInOrder(url: string) {
    for (const loader of loaders) {
      try {
        const delta = await loader(url);
        if (delta) return delta;
      } catch {}
    }
    return null;
  }

  // tải song song
  const deltas = await Promise.all(urls.map(loadInOrder));

  // merge theo thứ tự chương
  for (const delta of deltas) {
    if (delta) state = mergeChapterStats(state, delta);
  }

  try { saveStoryState(storyUrl, state); } catch {}
  return state;
}


/**
 * Alias tiện dụng: áp dụng delta AI của một chương vào state nền.
 * (Giữ nguyên mergeChapterStats hiện có; KHÔNG thay đổi logic khác.)
 */
export function applyChapterStats(base: CharacterStats, delta: Partial<CharacterStats> | null): CharacterStats {
  return mergeChapterStats(base || ({} as CharacterStats), (delta || {}) as Partial<CharacterStats>);
}
