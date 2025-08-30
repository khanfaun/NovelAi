import type { Story, Chapter } from '@/types';

// =================================================================
// SHARED UTILITIES
// =================================================================

// Xác định các proxy với các trình tạo URL cụ thể
const CORS_PROXIES = [
    {
        name: 'AllOrigins',
        buildUrl: (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    },
    {
        name: 'CORS.EU.ORG',
        // proxy này lấy URL thô làm tham số đường dẫn.
        buildUrl: (url: string) => `https://cors.eu.org/${url}`
    },
    {
        name: 'CORSProxy.io',
        // proxy này lấy URL thô làm tham số truy vấn.
        buildUrl: (url: string) => `https://corsproxy.io/?${url}`
    }
];

// Sắp xếp lại proxy để thử những proxy có khả năng đáng tin cậy/ít nghiêm ngặt hơn trước.
const ORDERED_PROXIES = [
    CORS_PROXIES[1], // CORS.EU.ORG
    CORS_PROXIES[2], // CORSProxy.io
    CORS_PROXIES[0]  // AllOrigins
];


const FETCH_TIMEOUT = 15000; // 15 giây

async function fetchAndParse(url: string): Promise<Document> {
  let lastError: Error | null = null;

  for (const proxy of ORDERED_PROXIES) {
    const proxyUrl = proxy.buildUrl(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Yêu cầu proxy thất bại với status: ${response.status}`);
      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      
      const docTextContent = doc.body.textContent?.toLowerCase() || "";
      const docTitle = doc.title.toLowerCase();
      const errorKeywords = ['cors', 'failed to fetch', 'cannot get', 'error', 'captcha', 'are you a robot', 'human verification', 'rate-limit'];

      if (errorKeywords.some(keyword => docTitle.includes(keyword) || docTextContent.includes(keyword))) {
          throw new Error(`Dịch vụ proxy (${proxy.name}) trả về trang lỗi hoặc captcha.`);
      }

      return doc;
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn(`Thất bại khi fetch từ proxy: ${proxy.name}. Đang thử proxy tiếp theo. Lỗi:`, (error as Error).message);
      lastError = error as Error;
    }
  }
  throw new Error(`Không thể tải dữ liệu từ ${url} sau khi thử tất cả các proxy. Nguồn truyện có thể đang chặn truy cập hoặc không khả dụng. Lỗi cuối cùng: ${lastError?.message}`);
}


function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD') // Tách ký tự thành chữ và dấu
    .replace(/[\u0300-\u036f]/g, '') // Bỏ các loại dấu
    .replace(/đ/g, 'd'); // Xử lý chữ 'đ'
}


// =================================================================
// SCRAPER IMPLEMENTATIONS
// =================================================================

// --- TRUYENFULL.VN ---
const TRUYENFULL_SOURCE = 'TruyenFull.vn';

async function searchOnTruyenFull(query: string): Promise<Story[]> {
    const BASE_URL = 'https://truyenfull.vn';
    const searchUrl = `${BASE_URL}/tim-kiem/?tukhoa=${encodeURIComponent(query)}`;
    const doc = await fetchAndParse(searchUrl);
    
    const stories: Story[] = [];
    doc.querySelectorAll('.list-truyen .row').forEach(rowEl => {
        const titleAnchor = rowEl.querySelector<HTMLAnchorElement>('h3.truyen-title a');
        const authorSpan = rowEl.querySelector<HTMLSpanElement>('.author');
        const imageElement = rowEl.querySelector<HTMLImageElement>('[data-image]');
        if (titleAnchor && authorSpan && imageElement) {
            stories.push({
                title: titleAnchor.innerText.trim(),
                url: titleAnchor.href,
                author: authorSpan.innerText.trim(),
                imageUrl: imageElement.getAttribute('data-image') || '',
                source: TRUYENFULL_SOURCE,
            });
        }
    });
    return stories;
}

async function getDetailsForTruyenFull(storyUrl: string) {
    // 1. Fetch và parse trang đầu tiên
    const doc = await fetchAndParse(storyUrl);

    // 2. Trích xuất thông tin cơ bản của truyện
    const title = doc.querySelector('h3.title')?.textContent?.trim() ?? '';
    const author = doc.querySelector('div.info a[itemprop="author"]')?.textContent?.trim() ?? '';
    const imageUrl = doc.querySelector('.book img')?.getAttribute('src') ?? '';
    const description = doc.querySelector('.desc-text')?.textContent?.trim() ?? 'Không có mô tả.';
    
    // 3. Trích xuất các chương từ trang đầu tiên
    const chapters: Chapter[] = [];
    doc.querySelectorAll('#list-chapter .list-chapter li a').forEach(el => {
        const chapterUrl = el.getAttribute('href');
        if (chapterUrl && el.textContent) {
            chapters.push({ title: el.textContent.trim(), url: chapterUrl });
        }
    });

    // 4. Xác định số trang cuối cùng
    let lastPage = 1;
    const lastPageAnchor = doc.querySelector<HTMLAnchorElement>('.pagination a[title="Trang cuối"]');
    if (lastPageAnchor) {
        const href = lastPageAnchor.href;
        const match = href.match(/\/trang-(\d+)\/?$/);
        if (match) {
            lastPage = parseInt(match[1], 10);
        }
    } else {
        // Fallback cho truyện có ít trang, không có link "Trang cuối"
        const pageLinks = doc.querySelectorAll<HTMLAnchorElement>('.pagination li a');
        if (pageLinks.length > 0) {
            const pageNumbers = Array.from(pageLinks)
                .map(a => {
                    try {
                        const url = new URL(a.href);
                        return url.pathname.match(/\/trang-(\d+)\/?$/);
                    } catch { return null; }
                })
                .filter((match): match is RegExpMatchArray => match !== null)
                .map(match => parseInt(match[1], 10));

            if (pageNumbers.length > 0) {
                lastPage = Math.max(1, ...pageNumbers);
            }
        }
    }

    // 5. Fetch các chương từ các trang tiếp theo (TUẦN TỰ) nếu có
    if (lastPage > 1) {
        const baseUrl = storyUrl.endsWith('/') ? storyUrl : `${storyUrl}/`;
        for (let i = 2; i <= lastPage; i++) {
            const pageUrl = `${baseUrl}trang-${i}/`;
            try {
                // Tải tuần tự từng trang để tránh bị giới hạn tốc độ hoặc chặn
                const pageDoc = await fetchAndParse(pageUrl);
                pageDoc.querySelectorAll('#list-chapter .list-chapter li a').forEach(el => {
                    const chapterUrl = el.getAttribute('href');
                    if (chapterUrl && el.textContent) {
                        chapters.push({ title: el.textContent.trim(), url: chapterUrl });
                    }
                });
            } catch (error) {
                console.warn(`Không thể tải trang chương ${i} từ ${pageUrl}. Danh sách chương có thể không đầy đủ. Lỗi:`, (error as Error).message);
                // Dừng lại nếu có lỗi để tránh chờ đợi vô ích và trả về những gì đã có.
                break;
            }
        }
    }
    
    // 6. Trả về toàn bộ dữ liệu đã thu thập
    return { title, author, imageUrl, description, chapters };
}


async function getChapterFromTruyenFull(chapterUrl: string) {
    const doc = await fetchAndParse(chapterUrl);
    const contentEl = doc.querySelector('#chapter-c');
    if (!contentEl) throw new Error("Không tìm thấy nội dung chương tại TruyenFull.vn.");
    contentEl.querySelectorAll('.ads-chapter, .ads, script, .meta-chap, #chapter-nav').forEach(el => el.remove());
    return contentEl;
}

// --- TRUYENFULL.VISION ---
const TRUYENFULLVISION_SOURCE = 'TruyenFull.vision';

async function searchOnTruyenFullVision(query: string): Promise<Story[]> {
    const BASE_URL = 'https://truyenfull.vision';
    const searchUrl = `${BASE_URL}/tim-kiem/?tukhoa=${encodeURIComponent(query)}`;
    const doc = await fetchAndParse(searchUrl);
    
    const stories: Story[] = [];
    doc.querySelectorAll('.list-truyen .row').forEach(rowEl => {
        const titleAnchor = rowEl.querySelector<HTMLAnchorElement>('h3.truyen-title a');
        const authorSpan = rowEl.querySelector<HTMLSpanElement>('.author');
        const imageElement = rowEl.querySelector<HTMLImageElement>('[data-image]');
        if (titleAnchor && authorSpan && imageElement) {
            stories.push({
                title: titleAnchor.innerText.trim(),
                url: titleAnchor.href,
                author: authorSpan.innerText.trim(),
                imageUrl: imageElement.getAttribute('data-image') || '',
                source: TRUYENFULLVISION_SOURCE,
            });
        }
    });
    return stories;
}
// TruyenFull.vision có cấu trúc tương tự TruyenFull.vn
const getDetailsForTruyenFullVision = getDetailsForTruyenFull;
const getChapterFromTruyenFullVision = getChapterFromTruyenFull;


// --- TANGTHUVIEN.NET ---
const TANGTHUVIEN_SOURCE = 'TangThuVien.net';

async function searchOnTangThuVien(query: string): Promise<Story[]> {
    const BASE_URL = 'https://truyen.tangthuvien.net';
    const searchUrl = `${BASE_URL}/ket-qua-tim-kiem?term=${encodeURIComponent(query)}`;
    const doc = await fetchAndParse(searchUrl);

    const stories: Story[] = [];
    doc.querySelectorAll('div.book-img-text ul li').forEach(itemEl => {
        const titleAnchor = itemEl.querySelector<HTMLAnchorElement>('div.book-mid-info h4 a');
        const authorAnchor = itemEl.querySelector<HTMLAnchorElement>('div.book-mid-info p.author a.name');
        const imageElement = itemEl.querySelector<HTMLImageElement>('div.book-img-box img');
        if (titleAnchor && authorAnchor && imageElement) {
            stories.push({
                title: titleAnchor.innerText.trim(),
                url: titleAnchor.href,
                author: authorAnchor.innerText.trim(),
                imageUrl: imageElement.src || '',
                source: TANGTHUVIEN_SOURCE,
            });
        }
    });
    return stories;
}

async function getDetailsForTangThuVien(storyUrl: string) {
    const doc = await fetchAndParse(storyUrl);
    const title = doc.querySelector('.book-info h1')?.textContent?.trim() ?? '';
    const author = doc.querySelector('.book-info .tag a.blue')?.textContent?.trim() ?? '';
    const imageUrl = doc.querySelector('div.book-img > img')?.getAttribute('src') ?? '';
    const description = Array.from(doc.querySelectorAll('.book-intro p'))
        .map(p => p.textContent?.trim())
        .filter(Boolean)
        .join('\n\n') || 'Không có mô tả.';
    const chapters: Chapter[] = [];

    // Cố gắng lấy ID truyện từ nhiều nguồn có thể
    let bookId: string | null = null;
    const urlMatch = storyUrl.match(/\/(?:doc-truyen|story)\/(\d+)/);
    if (urlMatch) {
        bookId = urlMatch[1];
    } else {
        const chapListButton = doc.querySelector<HTMLButtonElement>('[onclick*="get_chap_list"]');
        const onclickAttr = chapListButton?.getAttribute('onclick');
        const idFromClick = onclickAttr?.match(/get_chap_list\((\d+)/)?.[1];
        if (idFromClick) {
            bookId = idFromClick;
        }
    }

    if (!bookId) {
        throw new Error('Không tìm thấy ID truyện cho danh sách chương của Tàng Thư Viện.');
    }

    const chapterListUrl = `https://truyen.tangthuvien.net/doc-truyen/${bookId}/muc-luc`;
    const chapterDoc = await fetchAndParse(chapterListUrl);
    
    chapterDoc.querySelectorAll('#j-bookCatalogPage ul li a').forEach(el => {
        const chapterUrl = el.getAttribute('href');
        if (chapterUrl && el.textContent) {
            chapters.push({ title: el.textContent.trim(), url: chapterUrl });
        }
    });
    return { title, author, imageUrl, description, chapters };
}


async function getChapterFromTangThuVien(chapterUrl: string) {
    const doc = await fetchAndParse(chapterUrl);
    const contentEl = doc.querySelector('.box-chap-content');
    if (!contentEl) throw new Error("Không tìm thấy nội dung chương tại TangThuVien.net.");
    contentEl.querySelectorAll('div[class*="google-auto-placed"], script').forEach(el => el.remove());
    return contentEl;
}

// --- TRUYENHDT.COM ---
const TRUYENHDT_SOURCE = 'TruyenHDT.com';

async function searchOnTruyenHdt(query: string): Promise<Story[]> {
    const BASE_URL = 'https://truyenhdt.com';
    const searchUrl = `${BASE_URL}/tim-kiem.html?key=${encodeURIComponent(query)}`;
    const doc = await fetchAndParse(searchUrl);

    const stories: Story[] = [];
    doc.querySelectorAll('ul.list-story > li').forEach(itemEl => {
        const titleAnchor = itemEl.querySelector<HTMLAnchorElement>('.info .title a');
        const authorSpan = itemEl.querySelector<HTMLSpanElement>('.info .author');
        const imageElement = itemEl.querySelector<HTMLImageElement>('.image a img');
        if (titleAnchor && authorSpan && imageElement) {
            stories.push({
                title: titleAnchor.innerText.trim(),
                url: titleAnchor.href,
                author: authorSpan.innerText.trim(),
                imageUrl: imageElement.src || '',
                source: TRUYENHDT_SOURCE,
            });
        }
    });
    return stories;
}

async function getDetailsForTruyenHdt(storyUrl: string) {
    const doc = await fetchAndParse(storyUrl);
    const title = doc.querySelector('.info .title')?.textContent?.trim() ?? '';
    const author = doc.querySelector('.info .author a')?.textContent?.trim() ?? '';
    const imageUrl = doc.querySelector('.books img')?.getAttribute('src') ?? '';
    const description = doc.querySelector('#story-info-detail .description')?.textContent?.trim() ?? 'Không có mô tả.';
    const chapters: Chapter[] = [];
    doc.querySelectorAll('#list-chapter ul.list-group li a').forEach(el => {
        const chapterUrl = el.getAttribute('href');
        if (chapterUrl && el.textContent) {
            chapters.push({ title: el.textContent.trim(), url: chapterUrl });
        }
    });
    return { title, author, imageUrl, description, chapters };
}

async function getChapterFromTruyenHdt(chapterUrl: string) {
    const doc = await fetchAndParse(chapterUrl);
    const contentEl = doc.querySelector('#chapter-content');
    if (!contentEl) throw new Error("Không tìm thấy nội dung chương tại TruyenHDT.com.");
    contentEl.querySelectorAll('.ads-in-content, script, style').forEach(el => el.remove());
    return contentEl;
}

// --- KHODOCSACH.COM ---
const KHODOCSACH_SOURCE = 'KhoDocSach.com';

async function searchOnKhoDocSach(query: string): Promise<Story[]> {
    const BASE_URL = 'https://khodocsach.com';
    const searchUrl = `${BASE_URL}/tim-kiem?q=${encodeURIComponent(query)}`;
    const doc = await fetchAndParse(searchUrl);

    const stories: Story[] = [];
    doc.querySelectorAll('.container .grid .item').forEach(itemEl => {
        const titleAnchor = itemEl.querySelector<HTMLAnchorElement>('.card-title a');
        const authorAnchor = itemEl.querySelector<HTMLAnchorElement>('.card-author a');
        const imageElement = itemEl.querySelector<HTMLImageElement>('.card-img-top img');
        if (titleAnchor && authorAnchor && imageElement) {
            stories.push({
                title: titleAnchor.innerText.trim(),
                url: titleAnchor.href,
                author: authorAnchor.innerText.trim(),
                imageUrl: imageElement.src || '',
                source: KHODOCSACH_SOURCE,
            });
        }
    });
    return stories;
}

async function getDetailsForKhoDocSach(storyUrl: string) {
    const doc = await fetchAndParse(storyUrl);
    const title = doc.querySelector('h2.series-title')?.textContent?.trim() ?? '';
    const author = doc.querySelector('.series-information .info-item:nth-child(1) a')?.textContent?.trim() ?? '';
    const imageUrl = doc.querySelector('.series-cover .img-in-ratio')?.getAttribute('data-bg') ?? '';
    const description = doc.querySelector('.summary-content .text')?.textContent?.trim() ?? 'Không có mô tả.';
    const chapters: Chapter[] = [];
    // Xử lý danh sách chương có phân trang
    const pageLinks = Array.from(doc.querySelectorAll<HTMLAnchorElement>('.pagination .page-item a.page-link'));
    const lastPageLink = pageLinks[pageLinks.length - 2]; // Link cuối cùng thường là 'Next', link áp chót là số trang cuối
    const lastPage = lastPageLink ? parseInt(lastPageLink.innerText, 10) : 1;

    for (let i = 1; i <= lastPage; i++) {
        const pageUrl = `${storyUrl}?page=${i}`;
        const pageDoc = (i === 1) ? doc : await fetchAndParse(pageUrl);
        pageDoc.querySelectorAll('#chapters .chapter-list a').forEach(el => {
            const chapterUrl = el.getAttribute('href');
            if (chapterUrl && el.textContent) {
                chapters.push({ title: el.textContent.trim(), url: chapterUrl });
            }
        });
    }

    return { title, author, imageUrl, description, chapters };
}

async function getChapterFromKhoDocSach(chapterUrl: string) {
    const doc = await fetchAndParse(chapterUrl);
    const contentEl = doc.querySelector('#chapter-content');
    if (!contentEl) throw new Error("Không tìm thấy nội dung chương tại KhoDocSach.com.");
    contentEl.querySelectorAll('script, style, .text-center').forEach(el => el.remove());
    return contentEl;
}

// --- TRUYENYY.MOBI ---
const TRUYENYY_SOURCE = 'TruyenYY.mobi';

async function searchOnTruyenYy(query: string): Promise<Story[]> {
    const BASE_URL = 'https://truyenyy.mobi';
    const searchUrl = `${BASE_URL}/search/?key=${encodeURIComponent(query)}`;
    const doc = await fetchAndParse(searchUrl);
    
    const stories: Story[] = [];
    doc.querySelectorAll<HTMLAnchorElement>('.book-list .book-item a').forEach(itemAnchor => {
        const titleDiv = itemAnchor.querySelector<HTMLDivElement>('.book-name');
        const authorDiv = itemAnchor.querySelector<HTMLDivElement>('.book-author');
        const imageElement = itemAnchor.querySelector<HTMLImageElement>('img');
        if (titleDiv) {
            stories.push({
                title: titleDiv.innerText.trim(),
                url: itemAnchor.href,
                author: authorDiv?.innerText.trim() || 'Đang cập nhật',
                imageUrl: imageElement?.src || '',
                source: TRUYENYY_SOURCE,
            });
        }
    });
    return stories;
}

async function getDetailsForTruyenYy(storyUrl: string) {
    const doc = await fetchAndParse(storyUrl);
    const title = doc.querySelector('.book-info .book-name')?.textContent?.trim() ?? '';
    const author = doc.querySelector('.book-info .author a')?.textContent?.trim() ?? '';
    const imageUrl = doc.querySelector('.book-info .book-img img')?.getAttribute('src') ?? '';
    const description = doc.querySelector('#book-info #book-intro')?.textContent?.trim() ?? 'Không có mô tả.';
    const chapters: Chapter[] = [];
    doc.querySelectorAll('#chapters-area .chapter-item a').forEach(el => {
        const chapterUrl = el.getAttribute('href');
        if (chapterUrl && el.textContent) {
            chapters.push({ title: el.textContent.trim(), url: chapterUrl });
        }
    });
    return { title, author, imageUrl, description, chapters };
}

async function getChapterFromTruyenYy(chapterUrl: string) {
    const doc = await fetchAndParse(chapterUrl);
    const contentEl = doc.querySelector('#chapter-content');
    if (!contentEl) throw new Error("Không tìm thấy nội dung chương tại TruyenYY.mobi.");
    contentEl.querySelectorAll('script, style, .ads-holder').forEach(el => el.remove());
    return contentEl;
}

// =================================================================
// UNIFIED API
// =================================================================

const scrapers = {
  [TRUYENFULL_SOURCE]: { search: searchOnTruyenFull, getDetails: getDetailsForTruyenFull, getChapter: getChapterFromTruyenFull },
  [TRUYENFULLVISION_SOURCE]: { search: searchOnTruyenFullVision, getDetails: getDetailsForTruyenFullVision, getChapter: getChapterFromTruyenFullVision },
  [TANGTHUVIEN_SOURCE]: { search: searchOnTangThuVien, getDetails: getDetailsForTangThuVien, getChapter: getChapterFromTangThuVien },
  [TRUYENHDT_SOURCE]: { search: searchOnTruyenHdt, getDetails: getDetailsForTruyenHdt, getChapter: getChapterFromTruyenHdt },
  [KHODOCSACH_SOURCE]: { search: searchOnKhoDocSach, getDetails: getDetailsForKhoDocSach, getChapter: getChapterFromKhoDocSach },
  [TRUYENYY_SOURCE]: { search: searchOnTruyenYy, getDetails: getDetailsForTruyenYy, getChapter: getChapterFromTruyenYy },
};

export async function searchStory(query: string): Promise<Story[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const searchPromises = Object.values(scrapers).map(scraper =>
    scraper.search(trimmedQuery).catch(err => {
      console.error(`Lỗi khi tìm kiếm trên một nguồn:`, (err as Error).message);
      return []; // Trả về mảng rỗng nếu có lỗi, để một nguồn lỗi không làm hỏng toàn bộ tìm kiếm.
    })
  );

  const resultsBySource = await Promise.all(searchPromises);
  const allStoriesRaw = resultsBySource.flat();

  // Lọc kết quả để đảm bảo tính chính xác
  const normalizedQuery = normalizeString(trimmedQuery);
  const queryWordCount = trimmedQuery.split(/\s+/).filter(Boolean).length;

  const filteredStories = allStoriesRaw.filter(story => {
    const normalizedTitle = normalizeString(story.title);
    const titleWordCount = story.title.split(/\s+/).filter(Boolean).length;
    // Điều kiện: Tiêu đề chuẩn hóa BẮT ĐẦU bằng truy vấn chuẩn hóa VÀ có cùng số từ.
    return normalizedTitle.startsWith(normalizedQuery) && titleWordCount === queryWordCount;
  });
  
  // Nếu bộ lọc nghiêm ngặt không có kết quả, thử bộ lọc lỏng hơn
  if (filteredStories.length === 0 && allStoriesRaw.length > 0) {
      console.warn("Bộ lọc tìm kiếm nghiêm ngặt không có kết quả. Chuyển sang bộ lọc lỏng hơn.");
      const lenientFiltered = allStoriesRaw.filter(story => normalizeString(story.title).includes(normalizedQuery));
      lenientFiltered.sort((a, b) => a.title.localeCompare(b.title));
      if (lenientFiltered.length > 0) return lenientFiltered;
  } else {
      filteredStories.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (filteredStories.length === 0 && allStoriesRaw.length === 0) {
      throw new Error(`Không tìm thấy truyện "${query}" từ bất kỳ nguồn nào. Vui lòng thử với tên khác hoặc kiểm tra kết nối mạng.`);
  }

  return filteredStories;
}

export async function getStoryDetails(story: Story): Promise<Story> {
  const scraper = scrapers[story.source as keyof typeof scrapers];
  if (!scraper) {
    throw new Error(`Nguồn không được hỗ trợ: ${story.source}`);
  }
  const details = await scraper.getDetails(story.url);
  // Dữ liệu mới từ trang chi tiết sẽ ghi đè lên dữ liệu từ kết quả tìm kiếm (có thể đã cũ)
  return { ...story, ...details };
}

export async function getStoryFromUrl(url: string): Promise<Story> {
  const hostname = new URL(url).hostname.toLowerCase();
  let source: string | null = null;
  let scraperKey: keyof typeof scrapers | null = null;

  if (hostname.includes('truyenfull.vn')) {
    source = TRUYENFULL_SOURCE;
    scraperKey = TRUYENFULL_SOURCE;
  } else if (hostname.includes('truyenfull.vision')) {
    source = TRUYENFULLVISION_SOURCE;
    scraperKey = TRUYENFULLVISION_SOURCE;
  } else if (hostname.includes('tangthuvien.net')) {
    source = TANGTHUVIEN_SOURCE;
    scraperKey = TANGTHUVIEN_SOURCE;
  } else if (hostname.includes('truyenhdt.com')) {
    source = TRUYENHDT_SOURCE;
    scraperKey = TRUYENHDT_SOURCE;
  } else if (hostname.includes('khodocsach.com')) {
    source = KHODOCSACH_SOURCE;
    scraperKey = KHODOCSACH_SOURCE;
  } else if (hostname.includes('truyenyy.mobi')) {
    source = TRUYENYY_SOURCE;
    scraperKey = TRUYENYY_SOURCE;
  }

  if (!source || !scraperKey) {
    throw new Error(`URL từ trang '${hostname}' không được hỗ trợ.`);
  }

  const scraper = scrapers[scraperKey];
  const details = await scraper.getDetails(url);

  return {
    ...details,
    url: url,
    source: source,
  };
}


export async function getChapterContent(chapter: Chapter, source: string): Promise<string> {
    const scraper = scrapers[source as keyof typeof scrapers];

    if (!scraper) {
        const hostname = new URL(chapter.url).hostname;
        // Logic dự phòng nếu source không được truyền đúng cách
        for (const key in scrapers) {
            if (hostname.includes(key.toLowerCase().split('.')[0])) {
                const contentElement = await scrapers[key as keyof typeof scrapers].getChapter(chapter.url);
                contentElement.innerHTML = contentElement.innerHTML.replace(/<br\s*\/?>/gi, '\n');
                const content = (contentElement.textContent ?? '').trim();
                return content ? content.replace(/\n\s*\n/g, '\n\n') : "Nội dung chương trống.";
            }
        }
        throw new Error(`Không tìm thấy scraper phù hợp cho nguồn: ${source || hostname}`);
    }

    const contentElement = await scraper.getChapter(chapter.url);
    
    // Dọn dẹp và chuyển đổi sang text, giữ lại các đoạn văn
    contentElement.innerHTML = contentElement.innerHTML.replace(/<br\s*\/?>/gi, '\n');
    const content = (contentElement.textContent ?? '').trim();
    return content ? content.replace(/\n\s*\n/g, '\n\n') : "Nội dung chương trống.";
}