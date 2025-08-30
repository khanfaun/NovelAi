// src/services/sync.ts
import type { CachedChapter, CharacterStats, ReadingHistoryItem, GoogleUser } from '@/types'

// =================================================================
// CONFIG
// =================================================================
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const API_KEY = (process.env.API_KEY as string) || '' // optional – dùng cho gapi.client.init
const SCOPES =
  'https://www.googleapis.com/auth/drive.file openid email profile'
const APP_FOLDER_NAME = 'TruyenReaderAppData'
const CHAPTERS_DIR = '_chapters'
const AI_DIR = '_ai'

// Persisted sign-in flag
const SIGNIN_FLAG = 'drive_signed_in_v1'

// =================================================================
// GLOBALS & HELPERS
// =================================================================
declare global {
  interface Window {
    google: any
    gapi: any
  }
}

let gapiLoaded = false
let accessToken: string | null = null
let currentUser: GoogleUser | null = null
let tokenClient: any = null
const authListeners: Array<(signedIn: boolean) => void> = []

// --- SINGLE-FLIGHT: tránh chạy song song gây trùng ---
const pendingOps: Record<string, Promise<any>> = {}
function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (pendingOps[key]) return pendingOps[key] as Promise<T>
  pendingOps[key] = (async () => {
    try { return await fn() }
    finally { delete pendingOps[key] }
  })()
  return pendingOps[key] as Promise<T>
}

function notifyAuthListeners() {
  for (const cb of authListeners) {
    try { cb(!!accessToken) } catch {}
  }
}

async function ensureGisLoaded() {
  if (window.google?.accounts?.oauth2) return
  await new Promise<void>((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
}

async function loadGapiScript(): Promise<void> {
  if (window.gapi?.load) return
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://apis.google.com/js/api.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Không thể tải gapi api.js'))
    document.head.appendChild(s)
  })
}

async function initGapiClient(): Promise<void> {
  if (gapiLoaded) return
  await new Promise<void>((resolve, reject) => {
    window.gapi.load('client', {
      callback: () => resolve(),
      onerror: () => reject(new Error('Không thể load gapi client')),
      timeout: 10000,
      ontimeout: () => reject(new Error('Tải gapi client quá hạn')),
    })
  })

  await window.gapi.client.init({
    apiKey: API_KEY || undefined,
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  })

  await window.gapi.client.load('drive', 'v3')
  gapiLoaded = true
}

async function fetchUserInfo(token: string): Promise<GoogleUser | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const u = await res.json()
    return {
      name: u.name || '',
      email: u.email || '',
      imageUrl: u.picture || '',
    }
  } catch {
    return null
  }
}

// =================================================================
// PUBLIC AUTH API (GIS + gapi.client.setToken) + PERSIST
// =================================================================
export async function initDriveSync(): Promise<void> {
  if (!CLIENT_ID) {
    throw new Error('Thiếu VITE_GOOGLE_CLIENT_ID trong .env.local')
  }
  await ensureGisLoaded()
  await loadGapiScript()
  await initGapiClient()

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: () => {}, // set trong signIn() / silentSignIn()
  })

  // Silent restore nếu trước đó đã đăng nhập
  if (localStorage.getItem(SIGNIN_FLAG) === '1') {
    try {
      const raw = localStorage.getItem('drive_token');
      if (raw) {
        const tok = JSON.parse(raw);
        if (tok && tok.access_token && (!tok.expires_at || tok.expires_at > Date.now())) {
          if (typeof gapi !== 'undefined' && gapi?.client?.setToken) {
            gapi.client.setToken(tok);
            console.log('[DriveSync] Restored token from localStorage');
          }
        }
      }
    } catch (e) {
      console.warn('[DriveSync] Silent token restore failed', e);
    }
  }
}

async function silentSignIn(): Promise<void> {
  if (!tokenClient) throw new Error('Auth chưa sẵn sàng.')
  return new Promise<void>((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp?.error) return reject(resp)
      const token = resp?.access_token || window.gapi.client.getToken()?.access_token
      if (!token) return reject(new Error('Không lấy được access_token'))
      accessToken = token
      window.gapi.client.setToken({ access_token: token })
      currentUser = await fetchUserInfo(token)
      notifyAuthListeners()
      resolve()
    }
    // prompt: '' -> không bật popup nếu user đã consent trước đó
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

export function listenToAuthChanges(callback: (signedIn: boolean) => void) {
  authListeners.push(callback)
}

export function isSignedIn(): boolean {
  return !!accessToken
}

export function getCurrentUser(): GoogleUser | null {
  return currentUser
}

export function getAccessToken(): string | null {
  return accessToken
}

export function signIn(): Promise<void> {
  if (!tokenClient) throw new Error('Auth chưa sẵn sàng. Hãy gọi initDriveSync() trước.')
  return new Promise<void>((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp?.error) return reject(resp)
      const token = resp?.access_token || window.gapi.client.getToken()?.access_token
      if (!token) return reject(new Error('Không lấy được access_token'))
      accessToken = token
      window.gapi.client.setToken({ access_token: token })
      currentUser = await fetchUserInfo(token)
      try { localStorage.setItem(SIGNIN_FLAG, '1') } catch {}
      notifyAuthListeners()
      resolve()
    }
    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

export function signOut(): void {
  if (accessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null
      currentUser = null
      try { localStorage.removeItem(SIGNIN_FLAG) } catch {}
      try { window.gapi.client.setToken(null) } catch {}
      notifyAuthListeners()
    })
  } else {
    accessToken = null
    currentUser = null
    try { localStorage.removeItem(SIGNIN_FLAG) } catch {}
    try { window.gapi.client.setToken(null) } catch {}
    notifyAuthListeners()
  }
}

// =================================================================
// DRIVE HELPERS
// =================================================================
let appFolderId: string | null = null

function requireSignedIn() {
  if (!isSignedIn()) throw new Error('Chưa đăng nhập vào Google Drive.')
  if (!gapiLoaded) throw new Error('gapi client chưa sẵn sàng.')
}

function sanitizeForFilename(url: string): string {
  return url.replace(/[^a-zA-Z0-9-.]/g, '_')
}

async function getAppFolderId(): Promise<string> {
  if (appFolderId) return appFolderId
  requireSignedIn()

  return singleFlight('getAppFolderId', async () => {
    const q =
      `mimeType='application/vnd.google-apps.folder' and ` +
      `name='${APP_FOLDER_NAME}' and 'root' in parents and trashed=false`

    const response = await window.gapi.client.drive.files.list({
      q,
      fields: 'files(id, name)',
      pageSize: 10,
      spaces: 'drive',
      corpora: 'user',
    })

    const files = response.result.files || []
    if (files.length > 0) {
      appFolderId = files[0].id
      console.log('[DriveSync] Tìm thấy thư mục app:', APP_FOLDER_NAME, `(id=${appFolderId})`)
      return appFolderId!
    } else {
      const fileMetadata = {
        name: APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root'],
      }
      const folderResponse = await window.gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id',
      })
      appFolderId = folderResponse.result.id
      console.log('[DriveSync] Tạo thư mục app thành công:', APP_FOLDER_NAME, `(id=${appFolderId})`)
      return appFolderId!
    }
  })
}

async function ensureSubfolder(parentId: string, name: string): Promise<string> {
  const res = await window.gapi.client.drive.files.list({
    q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)', pageSize: 1,
  })
  if (res.result.files?.length) {
    console.log('[DriveSync] Tìm thấy thư mục con:', name, `(id=${res.result.files[0].id})`)
    return res.result.files[0].id
  }
  const created = await window.gapi.client.drive.files.create({
    resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  })
  console.log('[DriveSync] Tạo thư mục con thành công:', name, `(id=${created.result.id})`)
  return created.result.id
}

async function getStoryRootFolderId(storyUrl: string): Promise<string> {
  const rootId = await getAppFolderId()
  const folderName = sanitizeForFilename(storyUrl)
  const q = `'${rootId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const res = await window.gapi.client.drive.files.list({ q, fields: 'files(id)', pageSize: 1 })
  if (res.result.files?.length) {
    console.log('[DriveSync] Tìm thấy thư mục truyện:', folderName, `(id=${res.result.files[0].id})`)
    return res.result.files[0].id
  }
  const created = await window.gapi.client.drive.files.create({
    resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [rootId] },
    fields: 'id',
  })
  console.log('[DriveSync] Tạo thư mục truyện thành công:', folderName, `(id=${created.result.id})`)
  return created.result.id
}

async function getChaptersFolderId(storyUrl: string): Promise<string> {
  const storyRoot = await getStoryRootFolderId(storyUrl)
  return ensureSubfolder(storyRoot, CHAPTERS_DIR)
}
async function getAIFolderId(storyUrl: string): Promise<string> {
  const storyRoot = await getStoryRootFolderId(storyUrl)
  return ensureSubfolder(storyRoot, AI_DIR)
}

async function searchFile(name: string, parentId: string): Promise<string | null> {
  requireSignedIn()
  const response = await window.gapi.client.drive.files.list({
    q: `'${parentId}' in parents and name='${name}' and trashed=false`,
    fields: 'files(id, name, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 10,
  })
  const files = response.result.files || []
  if (files.length) {
    console.log('[DriveSync] Tìm thấy file:', name, `(id=${files[0].id})`)
  } else {
    console.log('[DriveSync] Không thấy file:', name)
  }
  return files.length ? files[0].id : null
}

async function readFile(fileId: string): Promise<any> {
  requireSignedIn()
  const response = await window.gapi.client.drive.files.get({ fileId, alt: 'media' })
  console.log('[DriveSync] Đọc file thành công (id=' + fileId + ')')
  return response.result
}

async function createFile(name: string, content: any, mimeType: string, parentId: string): Promise<string> {
  requireSignedIn()
  const metadata = { name, mimeType, parents: [parentId] }
  const boundary = '-------314159265358979323846'
  const delimiter = `\r\n--${boundary}\r\n`
  const close_delim = `\r\n--${boundary}--`

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    (typeof content === 'object' ? JSON.stringify(content) : content) +
    close_delim

  const response = await window.gapi.client.request({
    path: '/upload/drive/v3/files',
    method: 'POST',
    params: { uploadType: 'multipart' },
    headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
    body: multipartRequestBody,
  })
  console.log('[DriveSync] Tạo file thành công:', name, `(id=${response.result.id})`)
  return response.result.id
}

async function updateFile(fileId: string, content: any, mimeType: string): Promise<void> {
  requireSignedIn()
  await window.gapi.client.request({
    path: `/upload/drive/v3/files/${fileId}`,
    method: 'PATCH',
    params: { uploadType: 'media' },
    headers: { 'Content-Type': mimeType },
    body: typeof content === 'object' ? JSON.stringify(content) : content,
  })
  console.log('[DriveSync] Cập nhật file thành công (id=' + fileId + ')')
}

// =================================================================
// PUBLIC SYNC FUNCTIONS
// =================================================================
export async function saveHistoryToDrive(history: ReadingHistoryItem[]): Promise<void> {
  const parentId = await getAppFolderId()
  const fileId = await searchFile('history.json', parentId)
  if (fileId) await updateFile(fileId, history, 'application/json')
  else await createFile('history.json', history, 'application/json', parentId)
}

export async function loadHistoryFromDrive(): Promise<ReadingHistoryItem[] | null> {
  try {
    const parentId = await getAppFolderId()
    const fileId = await searchFile('history.json', parentId)
    if (!fileId) return null
    return await readFile(fileId)
  } catch (error) {
    console.error('Không thể tải lịch sử từ Drive:', error)
    return null
  }
}

// Story state (tổng)
export async function saveStoryStateToDrive(storyUrl: string, state: CharacterStats): Promise<void> {
  const parentId = await getAppFolderId()
  const filename = `${sanitizeForFilename(storyUrl)}.json`
  const fileId = await searchFile(filename, parentId)
  if (fileId) await updateFile(fileId, state, 'application/json')
  else await createFile(filename, state, 'application/json', parentId)
}
export async function loadStoryStateFromDrive(storyUrl: string): Promise<CharacterStats | null> {
  try {
    const parentId = await getAppFolderId()
    const filename = `${sanitizeForFilename(storyUrl)}.json`
    const fileId = await searchFile(filename, parentId)
    if (!fileId) return null
    return await readFile(fileId)
  } catch (error) {
    console.error('Không thể tải trạng thái truyện từ Drive:', error)
    return null
  }
}

// Chapter content
export async function saveChapterToDrive(storyUrl: string, chapterUrl: string, data: CachedChapter): Promise<void> {
  const chaptersFolderId = await getChaptersFolderId(storyUrl)
  const filename = `${sanitizeForFilename(chapterUrl)}.json`
  const fileId = await searchFile(filename, chaptersFolderId)
  const contentOnly = { content: (data as any).content ?? (data as any) }
  if (fileId) await updateFile(fileId, contentOnly, 'application/json')
  else await createFile(filename, contentOnly, 'application/json', chaptersFolderId)
}
export async function loadChapterFromDrive(storyUrl: string, chapterUrl: string): Promise<CachedChapter | null> {
  try {
    const chaptersFolderId = await getChaptersFolderId(storyUrl)
    const filename = `${sanitizeForFilename(chapterUrl)}.json`
    const fileId = await searchFile(filename, chaptersFolderId)
    if (!fileId) return null
    return await readFile(fileId)
  } catch (error) {
    console.error('Không thể tải chương từ Drive:', error)
    return null
  }
}

// AI per chapter
export async function saveChapterAIToDrive(storyUrl: string, chapterUrl: string, ai: CharacterStats | null): Promise<void> {
  if (!ai) return
  const aiFolderId = await getAIFolderId(storyUrl)
  const filename = `${sanitizeForFilename(chapterUrl)}.ai.json`
  const fileId = await searchFile(filename, aiFolderId)
  if (fileId) await updateFile(fileId, ai, 'application/json')
  else await createFile(filename, ai, 'application/json', aiFolderId)
}
export async function loadChapterAIFromDrive(storyUrl: string, chapterUrl: string): Promise<CharacterStats | null> {
  try {
    const aiFolderId = await getAIFolderId(storyUrl)
    const filename = `${sanitizeForFilename(chapterUrl)}.ai.json`
    const fileId = await searchFile(filename, aiFolderId)
    if (!fileId) return null
    return await readFile(fileId)
  } catch (e) {
    console.error('Không thể tải AI theo chương từ Drive:', e)
    return null
  }
}
