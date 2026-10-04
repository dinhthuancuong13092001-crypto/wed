export const resources = {
  posts: {
    label: "Bài viết",
    singular: "bài viết",
    route: "tin-tuc",
    icon: "FileText",
  },
  announcements: {
    label: "Thông báo",
    singular: "thông báo",
    route: "thong-bao",
    icon: "Megaphone",
  },
  events: {
    label: "Sự kiện",
    singular: "sự kiện",
    route: "su-kien",
    icon: "CalendarDays",
  },
  albums: {
    label: "Album ảnh",
    singular: "album ảnh",
    route: "thu-vien",
    icon: "Images",
  },
  videos: { label: "Video", singular: "video", route: "video", icon: "Video" },
  teachers: {
    label: "Giáo viên",
    singular: "giáo viên",
    route: "doi-ngu",
    icon: "Users",
  },
  pages: {
    label: "Trang",
    singular: "trang",
    route: "trang",
    icon: "PanelsTopLeft",
  },
  categories: {
    label: "Chuyên mục",
    singular: "chuyên mục",
    route: "chuyen-muc",
    icon: "Folder",
  },
} as const;
export type Resource = keyof typeof resources;
export type Role = "SUPER_ADMIN" | "ADMIN" | "EDITOR" | "AUTHOR";
export type User = { id: string; name: string; email: string; role: Role };
export type RecordItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  status: string;
  author_id: string;
  author_name?: string;
  cover: string;
  category_id: string | null;
  category_name?: string;
  published_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  views: number;
  data: Record<string, any>;
};
export type Settings = Record<string, string>;
export const settingFields = {
  schoolName: "Tên trường",
  shortName: "Tên viết tắt",
  slogan: "Slogan",
  logo: "Logo (URL)",
  favicon: "Favicon (URL)",
  primaryColor: "Màu chủ đạo",
  heroTitle: "Tiêu đề banner",
  heroText: "Nội dung banner",
  heroImage: "Ảnh banner (URL)",
  heroButton: "Nút banner",
  heroLink: "Liên kết banner",
  about: "Giới thiệu chung",
  history: "Lịch sử hình thành",
  vision: "Tầm nhìn",
  mission: "Sứ mệnh",
  values: "Giá trị cốt lõi",
  organization: "Cơ cấu tổ chức",
  facilities: "Cơ sở vật chất",
  achievements: "Thành tích",
  students: "Số học sinh",
  teacherCount: "Số giáo viên",
  classrooms: "Số phòng học",
  years: "Số năm hình thành",
  address: "Địa chỉ",
  phone: "Điện thoại",
  email: "Email",
  website: "Website",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  maps: "Google Maps (URL)",
  mapsEmbed: "Liên kết bản đồ nhúng Google Maps",
  footer: "Nội dung chân trang",
  seoTitle: "Tiêu đề SEO",
  seoDescription: "Mô tả SEO",
  canonicalUrl: "Tên miền chính (URL)",
};
export const defaultMenu = [
  ["Trang chủ", "/"],
  ["Giới thiệu", "/gioi-thieu"],
  ["Tin tức", "/tin-tuc"],
  ["Thông báo", "/thong-bao"],
  ["Sự kiện", "/su-kien"],
  ["Thư viện", "/thu-vien"],
  ["Video", "/video"],
  ["Liên hệ", "/lien-he"],
];
