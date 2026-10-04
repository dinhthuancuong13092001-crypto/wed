# Đưa website lên hosting Node.js và MySQL

Yêu cầu: Node.js 22 trở lên và MySQL 8.0.16 trở lên. Đây là cấu trúc database mới, không chuyển dữ liệu PostgreSQL hiện có.

1. Trong cPanel, tạo database MySQL, tạo người dùng và cấp quyền cho database đó. Tên database/người dùng thường có tiền tố tài khoản hosting.
2. Chọn database trong phpMyAdmin, vào **Import**, chọn `school.mysql.sql`. Không nhập `school.sql` vì đó là bản PostgreSQL. Ứng dụng cũng tự tạo bảng còn thiếu khi khởi động.
3. Đưa mã nguồn lên thư mục ứng dụng. Giữ `package.json`, `package-lock.json`, `database/`, `scripts/`, `public/`, `pages/`, `components/`, `lib/`, `styles/` và các file cấu hình. Không tải `node_modules/`, `.env` trên máy, `data/postgres/` hoặc tệp thông tin tài khoản quản trị lên hosting.
4. Sao chép `.env.mysql.example` thành `.env`, điền database, người dùng, mật khẩu và tên miền. Mã hóa URL các ký tự đặc biệt trong mật khẩu. Giữ `LOCAL_DATABASE=false`. Tạo hai secret riêng bằng `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` rồi điền `AUTH_SECRET` và `SETUP_TOKEN`.
5. Trong **Setup Node.js App**, chọn Node.js 22 hoặc mới hơn, production, thư mục ứng dụng, tên miền và startup file `server.mjs`. Hosting cần hỗ trợ startup ESM và chuyển tiếp HTTP tới ứng dụng. Dùng `PORT` do hosting cấp nếu có; cấu hình cPanel/Passenger cụ thể phụ thuộc nhà cung cấp.
6. Trong terminal của ứng dụng chạy:

```sh
npm ci
npm run db:migrate
npm run build
```

7. Khởi động/restart ứng dụng trong bảng điều khiển hosting. Nếu hosting dùng process manager chạy lệnh, dùng `npm start`.
8. Mở `https://ten-mien-cua-ban/api/health` để kiểm tra kết nối, sau đó `/admin/setup`. Nhập `SETUP_TOKEN`, tạo tài khoản quản trị rồi xóa `SETUP_TOKEN` khỏi môi trường và restart.

Thư mục `uploads/` cần cho phép ứng dụng ghi và phải lưu bền vững. Để giữ nội dung cũ, cần chuyển dữ liệu riêng và sao chép media; nhập schema không sao lưu hay di chuyển bài viết. Sao lưu MySQL bằng công cụ của hosting và sao lưu `uploads/` cùng thời điểm.

Nếu bảng điều khiển báo MariaDB hoặc MySQL phiên bản thấp hơn yêu cầu, cần điều chỉnh schema theo đúng phiên bản trước khi nhập. Cấu hình này dùng kiểu JSON và giá trị mặc định dạng biểu thức của [MySQL](https://dev.mysql.com/doc/refman/8.0/en/data-type-defaults.html), cùng trình điều khiển [mysql2](https://sidorares.github.io/node-mysql2/docs/examples/connections/create-pool).
