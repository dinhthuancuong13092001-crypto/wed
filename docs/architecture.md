# Kiến trúc hệ thống

## Luồng chính

Browser → Next.js SSR/API → validation/authorization → PostgreSQL. Ảnh → xử lý Sharp → local filesystem hoặc S3 → bản ghi media. Website công khai đọc trực tiếp database ở mỗi request, vì vậy bài mới xuất bản xuất hiện ngay. Không dùng localStorage để lưu nội dung hay tài khoản.

## Database

`roles`, `users`, `sessions`: vai trò, tài khoản với mật khẩu hash, phiên opaque lưu HMAC token (12 giờ).

`posts`, `announcements`, `events`, `albums`, `videos`, `teachers`, `pages`, `categories`: mỗi loại có bảng riêng, UUID, slug unique, tác giả FK, chuyên mục FK khi phù hợp, trạng thái CHECK, ngày xuất bản và timestamps, soft delete và index nội dung công khai/tác giả. Những trường riêng (thời gian sự kiện, SEO, vị trí giáo viên, URL video, ảnh album) nằm trong JSONB `data`, được validation theo loại trong API.

`post_categories`, `album_images`: bảng liên kết cho chuyên mục bài viết và media album. `media` chứa metadata/URL/storage key, không chứa binary. `menus`, `menu_items`: liên kết có menu cha, thứ tự, trạng thái. `site_settings`, `seo_settings`: cấu hình, metadata. `contact_messages`: lời nhắn có trạng thái đã đọc. `audit_logs`: người thực hiện, thao tác, đối tượng, thời gian. `rate_limits`: counter theo cửa sổ trong PostgreSQL, dùng chung giữa nhiều instance.

## Bảo mật

- SQL tham số cho toàn bộ input; tên bảng lấy từ allowlist `resources`.
- API xác thực mọi request admin và kiểm tra tác giả sở hữu đối tượng khi là AUTHOR.
- Session cookie HttpOnly, SameSite=Strict; Secure bật khi triển khai HTTPS.
- Mutations kiểm tra Origin bằng NEXT_PUBLIC_SITE_URL; không tin Host/forwarded headers làm nguồn canonical.
- Mật khẩu scrypt+salt, secret nằm ở environment. Đổi tài khoản thu hồi sessions.
- Setup có token bảo mật và khóa bảng users trong transaction để chỉ tạo admin đầu tiên.
- Sanitize HTML phía server, allowlist iframe YouTube, chặn javascript URL và event handlers.
- Upload decode ảnh thực, giới hạn dung lượng/pixel, chuyển WEBP; không upload SVG/HTML.
- Rate limit login theo socket/email, setup, contact và upload, lưu ở PostgreSQL.
- Security headers, CSP, admin noindex; phản hồi lỗi không log secret.

## Các quyết định triển khai

Chọn Next.js Pages Router cho SSR, routes API và custom launcher Node đơn giản trên Windows/Linux. ORM không bắt buộc; `pg` và SQL migration dùng constraint/FK/index của PostgreSQL trực tiếp. CSS dùng design tokens xanh/trắng, font Be Vietnam Pro được phục vụ tại máy, layout responsive. PostgreSQL cục bộ giúp preview.bat có thể dùng ngay mà không yêu cầu cài service database thủ công. Production dùng PostgreSQL riêng, HTTPS reverse proxy và storage bền vững.

Tệp server.mjs đặt NODE_ENV đúng trước khi import Next, kiểm tra environment/build/database, migration và lỗi cổng. Tệp BAT kiểm tra Node/dependencies và giữ thông báo lỗi. Nội dung, tài khoản và thông tin trường đều không được seed giả.

## Phạm vi và vận hành

Video dùng YouTube; tài liệu thông báo dùng URL ngoài. Form liên hệ lưu database, quản trị xem hộp thư; không có dịch vụ gửi mail được cấu hình. Menu có submenu và nút sắp xếp, không yêu cầu drag/drop. Media S3 cần credentials và bucket thật của người vận hành. HTTPS, DNS và sao lưu dựa vào hạ tầng triển khai, không thể tạo chứng chỉ/tên miền chỉ bằng source local.
