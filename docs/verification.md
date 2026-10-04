# Kết quả kiểm tra ngày 04/10/2026

Môi trường: Windows, Node.js 24.17.0, PostgreSQL 18 cục bộ thật, Next.js 16.3.8, Chrome headless.

- `npm install`: thành công; có `package-lock.json`.
- `npm run check`: TypeScript thành công.
- `npm run build`: production build thành công, routes SSR/API/admin/sitemap/robots đều được build.
- `npm run start`: website hoạt động tại http://localhost:3000.
- `start.bat`: migration và production server chạy thành công sau chuẩn hóa CRLF.
- `preview.bat`: khởi động thành công, health check đạt, có lệnh mở browser Windows.
- `/api/health`: HTTP 200 và `{"status":"ok"}`.
- Cổng đang dùng: launcher báo “Cổng 3000 đang được sử dụng.” và trả exit code 1.
- `npm audit --omit=dev`: không có lỗ hổng đã biết trong dependency production tại thời điểm kiểm tra.

## API tích hợp

9 nhóm kiểm thử thành công: health/anonymous/admin redirect/404; first setup và khóa setup; CSRF; draft/publish/SEO/hide/trash/restore/slug unique/XSS; chuyên mục/thông báo/sự kiện/album/video/đội ngũ/trang; ảnh/thumbnail/alt/bảo vệ ảnh đang dùng; AUTHOR ownership và quyền EDITOR; tìm kiếm/phân trang/form liên hệ/audit; cấu hình lưu thật/validation atomic/menu submenu/logout.

## Trình duyệt

Đăng nhập → tạo bài qua TipTap → xuất bản → refresh vẫn giữ dữ liệu → đọc nội dung công khai thành công. Upload ảnh qua input file thành công. Đăng xuất và truy cập lại admin bị chuyển về login. Không có JavaScript runtime error.

Kiểm tra desktop 1440×1000 và mobile 390×844, website công khai/quản trị không tràn ngang. Hamburger menu hoạt động. Dashboard hiển thị trạng thái trống và CTA bài đầu tiên. Các ảnh kiểm tra nằm trong `test-results/` (không commit).

## Dữ liệu bàn giao

Đã xóa toàn bộ dữ liệu tạm và tài khoản kiểm thử. Posts = 0, Announcements = 0, Events = 0, Albums = 0, Videos = 0. Không tạo tài khoản/mật khẩu mặc định; người sử dụng tự tạo Super Admin qua `/admin/setup` hoặc CLI.

## Giới hạn xác minh

## Bổ sung theo yêu cầu người dùng

Đã tạo tài khoản `admin` với vai trò SUPER_ADMIN trong database cục bộ. Mật khẩu ngẫu nhiên lưu riêng trong `TAI_KHOAN_ADMIN.txt`, không nằm trong source/ZIP. Đã kiểm tra đăng nhập bằng tên người dùng, đổi mật khẩu qua giao diện, chặn mật khẩu hiện tại sai, thu hồi phiên cũ và đăng nhập bằng mật khẩu mới. Tài khoản kiểm thử riêng đã được xóa; mật khẩu admin ban đầu được giữ nguyên cho người dùng.

Production build mới có mục **Tài khoản của tôi**. Đã sửa Origin/SEO dùng URL runtime khi preview chọn cổng khác 3000; đã kiểm tra đăng nhập thực trên cổng thay thế. `preview.py --build` mở phiên chạy build mới, tránh dùng lại phiên có code cũ.

Đã kiểm tra local PostgreSQL và local media. Storage S3, tên miền công khai, HTTPS reverse proxy, backup/restore vào máy khác chưa được kiểm tra do chưa có hạ tầng/credentials tương ứng. Có code storage và hướng dẫn triển khai; việc kết nối những dịch vụ này cần cấu hình thực tế. Video hỗ trợ YouTube URL, tài liệu thông báo hỗ trợ URL ngoài. Không có gửi email tự động từ form liên hệ.
