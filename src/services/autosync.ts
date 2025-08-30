// src/services/autosync.ts
import type { CachedChapter, CharacterStats } from '@/types'
import {
  isSignedIn,
  listenToAuthChanges,
  saveChapterToDrive,
  saveChapterAIToDrive,
  loadChapterAIFromDrive,
} from '@/services/sync'

// ---- Cấu hình ----
const DEBOUNCE_MS = 1500          // gộp nhiều lần gọi trong ~1.5s
const MAX_RETRY = 3               // retry tối đa
const RETRY_BASE_MS = 1000        // backoff: 1s, 2s, 4s,...
const QUEUE_STORAGE_KEY = 'autosyncQueue.v1' // lưu tạm khi offline/chưa đăng nhập

type ChapterSyncJob = {
  storyUrl: string
  chapterUrl: string
  chapterData: CachedChapter         // nội dung chương (bạn đang có sẵn)
  aiData?: CharacterStats | null     // dữ liệu AI theo chương (nếu có)
  retry?: number
}

// ---- Hàng đợi + tập dedupe ----
const queue: ChapterSyncJob[] = []
const pendingKeys = new Set<string>()
let timer: any = null

function keyOf(job: ChapterSyncJob) {
  return `${job.storyUrl}::${job.chapterUrl}`
}

function saveQueueToLocalStorage() {
  try { localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue)) } catch {}
}

function loadQueueFromLocalStorage() {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY)
    if (!raw) return
    const arr = JSON.parse(raw) as ChapterSyncJob[]
    for (const job of arr) {
      const k = keyOf(job)
      if (!pendingKeys.has(k)) {
        pendingKeys.add(k)
        queue.push(job)
      }
    }
  } catch {}
}

function schedule() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, DEBOUNCE_MS)
}

async function runJob(job: ChapterSyncJob) {
  // Đồng bộ nội dung chương
  await saveChapterToDrive(job.storyUrl, job.chapterUrl, job.chapterData)

  // Đồng bộ AI theo chương (nếu có)
  if (job.aiData) {
    await saveChapterAIToDrive(job.storyUrl, job.chapterUrl, job.aiData)
  }
}

async function flush() {
  if (!isSignedIn()) {
    // Chưa đăng nhập → lưu queue lại chờ sign-in
    saveQueueToLocalStorage()
    return
  }

  while (queue.length) {
    const job = queue[0]
    try {
      await runJob(job)
      // thành công
      queue.shift()
      pendingKeys.delete(keyOf(job))
      saveQueueToLocalStorage()
    } catch (err) {
      const retry = (job.retry ?? 0) + 1
      if (retry > MAX_RETRY) {
        // bỏ job này nhưng vẫn log
        console.warn('[AutoSync] Bỏ qua sau khi retry nhiều lần:', job, err)
        queue.shift()
        pendingKeys.delete(keyOf(job))
        saveQueueToLocalStorage()
        continue
      }
      job.retry = retry
      const backoff = RETRY_BASE_MS * Math.pow(2, retry - 1)
      console.warn(`[AutoSync] Lỗi, sẽ thử lại sau ${backoff}ms`, err)
      // chờ backoff rồi thử toàn queue lại
      setTimeout(schedule, backoff)
      return
    }
  }
}

// Gọi một lần đâu app
export function initAutosync() {
  // nạp lại queue nếu có
  loadQueueFromLocalStorage()
  // flush khi vừa đăng nhập xong
  listenToAuthChanges((signedIn) => {
    if (signedIn) schedule()
  })
  // thử flush ngay (trường hợp đã đăng nhập sẵn)
  schedule()
}

/** Enqueue đồng bộ 1 chương – gọi ngay sau khi bạn có đủ dữ liệu chương */
export function enqueueChapterSync(
  storyUrl: string,
  chapterUrl: string,
  chapterData: CachedChapter,
  aiData?: CharacterStats | null
) {
  const job: ChapterSyncJob = { storyUrl, chapterUrl, chapterData, aiData: aiData ?? undefined }
  const k = keyOf(job)
  if (pendingKeys.has(k)) {
    // đã có job cùng chương → chỉ update dữ liệu mới nhất
    const idx = queue.findIndex(j => keyOf(j) === k)
    if (idx >= 0) queue[idx] = job
  } else {
    pendingKeys.add(k)
    queue.push(job)
  }
  saveQueueToLocalStorage()
  schedule()
}
