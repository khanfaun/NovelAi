export interface Chapter {
  title: string;
  url: string;
}

export interface Story {
  title: string;
  author: string;
  imageUrl: string;
  source: string; // ví dụ: 'TruyenFull.vn', 'MetruyenCV.com'
  url: string; // URL của trang chính của truyện
  description?: string;
  chapters?: Chapter[];
}

export interface ReadingHistoryItem {
  title: string;
  author: string;
  url: string;
  source: string;
  imageUrl: string;
  lastChapterUrl: string;
  lastReadTimestamp: number;
}

export interface TuChat {
  ten: string; // ví dụ: "Thiên Đạo Trúc Cơ", "Tâm Ma Thệ"
  moTa: string; // ví dụ: "Loại trúc cơ mạnh nhất, dung hợp với thiên đạo."
}

export interface CharacterStatus {
  ten: string;
  tuChat?: TuChat[]; // Danh sách các tư chất, đặc tính của nhân vật
}

export interface NPC {
  ten:string;
  moTa: string; // Mô tả vai trò, phe phái, hoặc mối quan-hệ với nhân vật chính
  status?: 'active' | 'dead';
}

export interface TheLuc { // Môn phái, Gia tộc, Thế lực
  ten: string;
  moTa: string; // Mô tả ngắn gọn về thế lực này
  status?: 'active' | 'destroyed';
}

export interface DiaDiem {
  ten: string;
  moTa: string; // Mô tả ngắn gọn về địa điểm này
  status?: 'active' | 'destroyed';
  capDo?: string; // Ví dụ: Giới Vực, Đại Vực, Châu Lục
  diaDiemCha?: string; // Tên của địa điểm cấp cao hơn
}

export interface InfoItem {
  ten: string;
  moTa: string; // Mô tả về công dụng, nguồn gốc, đặc điểm
  status?: 'active' | 'used' | 'lost';
}

export interface QuanHe {
  nhanVat1: string;
  nhanVat2: string;
  moTa: string; // Mô tả mối quan hệ: Đồng minh, Kẻ thù, Sư đồ, Gia tộc...
}

export interface CharacterStats {
  trangThai?: CharacterStatus;
  canhGioi?: string;
  heThongCanhGioi?: string[]; // Hệ thống các cảnh giới tu luyện của truyện
  balo?: InfoItem[];
  congPhap?: InfoItem[];
  trangBi?: InfoItem[];
  npcs?: NPC[]; // Danh sách nhân vật phụ mới hoặc có tương tác quan trọng
  theLuc?: TheLuc[]; // Danh sách các thế lực, môn phái, gia tộc được đề cập
  diaDiem?: DiaDiem[]; // Danh sách các địa điểm mới xuất hiện
  viTriHienTai?: string; // Tên của địa điểm hiện tại của nhân vật chính
  quanHe?: QuanHe[]; // Danh sách các mối quan hệ giữa các nhân vật
}

export interface CachedChapter {
  content: string;
  stats: CharacterStats | null;
}

export interface ReadingSettings {
  themeMode: 'dark' | 'light' | 'midnight';
  backgroundColor: string;
  textColor: string;
  titleColor: string;
  highlightColor: string;
  fontSize: number;
  fontFamily: string;
}

export interface GoogleUser {
  name: string;
  email: string;
  imageUrl: string;
}