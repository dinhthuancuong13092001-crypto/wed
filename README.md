# Website trường học & CMS

Hosting Node.js + MySQL: nhập `school.mysql.sql` và làm theo [hướng dẫn hosting MySQL](docs/hosting-mysql.md). Giữ `school.sql` cho PostgreSQL. Chọn hệ database bằng tiền tố `mysql://` hoặc `postgresql://` của `DATABASE_URL`.

Website công khai và quản trị nội dung bằng tiếng Việt. Next.js, React, TypeScript, TipTap, PostgreSQL thật và truy vấn tham số qua `pg`. Không seed bài viết, thông báo, sự kiện, album, video, chuyên mục hoặc tài khoản mặc định.

## Chạy nhanh trên Windows 10/11

Cách chạy bằng Python (Python 3.10 trở lên và Node.js 22/24 LTS): double-click **preview.py**, hoặc mở terminal trong thư mục dự án và chạy `py preview.py`. Chạy `py preview.py --build` để build lại trước khi mở website. Không cần cài thêm thư viện Python. `py preview.py --check` kiểm tra môi trường; `--no-browser` khởi động mà không mở browser. Python gọi launcher hiện có để chuẩn bị PostgreSQL và chạy đúng production server.

Nếu website của cùng dự án đã chạy, launcher mở lại website đó. Nếu cổng 3000 bị ứng dụng khác chiếm, launcher tự chọn một cổng trống, hiển thị URL mới và mở browser bằng đúng URL; không sửa `.env` và không tắt ứng dụng khác. Địa chỉ phiên preview gần nhất được lưu trong `.preview-runtime.json` để lần chạy tiếp theo nhận diện đúng server.

Logo trường được lưu tại `public/logo-truong.jpg`. Tên trường và logo ban đầu nằm trong `database/initial-settings.json`, được đưa vào cấu hình khi còn thiếu. Admin vẫn thay đổi được; migration không ghi đè cấu hình đã lưu. Không tạo bài đăng mẫu.

1. Cài **Node.js 22 hoặc 24 LTS** từ https://nodejs.org.
2. Giải nén toàn bộ dự án vào một thư mục. Giữ `package-lock.json`.
3. Double-click **preview.bat**. Lần đầu sẽ cài dependencies, tạo `.env` với secret ngẫu nhiên, chuẩn bị PostgreSQL cục bộ, chạy migration, build và mở trình duyệt tại http://localhost:3000.
4. Mở `/admin/setup`. Mở `.env` trên máy của bạn và sao chép giá trị **SETUP_TOKEN** vào ô mã thiết lập. Nhập tên, email và mật khẩu tối thiểu 12 ký tự của bạn.
5. Thiết lập chỉ cho phép tạo Super Admin khi chưa có Super Admin nào. Sau đó vào `/admin/settings` để nhập tên trường, logo, banner và thông tin liên hệ.
6. Vào **Bài viết → Tạo bài viết đầu tiên → Xuất bản**. Bài được lưu vào PostgreSQL và hiển thị ở trang chủ, `/tin-tuc`, URL chi tiết và sitemap.

Không gửi `.env`, mật khẩu hoặc SETUP_TOKEN cho người khác. Xóa SETUP_TOKEN khỏi `.env` sau khi đã tạo tài khoản. Không tạo tài khoản mẫu; bạn là người tạo tài khoản và bài viết đầu tiên.

`start.bat` thực hiện kiểm tra tương tự và chạy production server, không mở trình duyệt. Khi xảy ra lỗi, các tệp BAT giữ cửa sổ để đọc thông báo. Giữ terminal đang chạy để website hoạt động. Dùng Ctrl+C để dừng server.

### PostgreSQL cục bộ

`LOCAL_DATABASE=true` sử dụng binary PostgreSQL 18 từ `embedded-postgres`, không phải SQLite hoặc dữ liệu giả lập. Database lưu trong `data/postgres`. Trên Windows, launcher tạm ánh xạ một ký tự ổ đĩa trống vào đúng thư mục dự án để PostgreSQL chạy được với đường dẫn tiếng Việt. Ổ này không sao chép hay di chuyển dữ liệu. Cần có một ký tự trống trong R–Z. Nếu máy hạn chế `subst`, dùng PostgreSQL riêng theo hướng dẫn bên dưới.

Không đồng bộ thư mục database đang chạy bằng OneDrive. Khi sử dụng thường xuyên, đặt toàn bộ dự án trong thư mục cục bộ ngoài OneDrive hoặc chuyển sang PostgreSQL riêng. Không mở đồng thời hai bản sao dự án dùng chung cổng database.

## Cài bằng terminal

Trong PowerShell, dùng `npm.cmd` nếu chính sách máy chặn `npm.ps1`:

```powershell
npm.cmd install
npm.cmd run db:migrate
npm.cmd run build
npm.cmd run start
```

`.env` được tạo an toàn khi chạy migration/server lần đầu. `.env.example` chỉ mô tả biến, không chứa secret thật.

### PostgreSQL riêng

Cài PostgreSQL và tạo database cùng tài khoản riêng. Ví dụ trong `psql` bằng tài khoản quản trị PostgreSQL:

```sql
CREATE ROLE school LOGIN;
\password school
CREATE DATABASE school OWNER school;
```

Sao chép `.env.example` thành `.env`, đặt:

```dotenv
DATABASE_URL=postgresql://school:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5432/school
AUTH_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
SETUP_TOKEN=YOUR_RANDOM_SETUP_TOKEN
NEXT_PUBLIC_SITE_URL=http://localhost:3000
PORT=3000
HOST=127.0.0.1
LOCAL_DATABASE=false
COOKIE_SECURE=false
MEDIA_DIR=uploads
```

Sinh mỗi secret độc lập bằng `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Dùng URL encoding cho ký tự đặc biệt trong mật khẩu database. Không log DATABASE_URL.

```powershell
npm.cmd run db:migrate
```

Schema được quản lý tại `database/schema.sql`. Migration chạy trong transaction và dùng advisory lock; chạy lại không seed hoặc xóa nội dung.

## Tạo Super Admin

Sau khi đăng nhập, vào **Tài khoản của tôi → Đổi mật khẩu**, nhập mật khẩu hiện tại và mật khẩu mới hai lần. Các phiên đăng nhập khác sẽ bị thu hồi. Mật khẩu mới cần ít nhất 12 ký tự.

Khuyến nghị `/admin/setup` để nhập mật khẩu ẩn. Thiết lập cần SETUP_TOKEN đúng và kiểm tra không có Super Admin trong transaction có khóa database, ngăn hai yêu cầu tạo đồng thời.

Có thể dùng CLI:

```powershell
npm.cmd run admin:create
```

CLI hỏi tên, email và mật khẩu; mật khẩu được hiển thị khi nhập tại terminal, không truyền trên command line. Mật khẩu lưu bằng scrypt với salt riêng. CLI cũng chỉ chạy khi chưa có Super Admin. Không có `admin/admin123`.

## Development, production và preview

```powershell
npm.cmd run dev       # Development server, có PostgreSQL
npm.cmd run check     # TypeScript
npm.cmd run build     # Production build
npm.cmd run start     # Production launcher server.mjs
npm.cmd run preview   # Build nếu thiếu, chạy server và mở browser trên Windows
```

Sau khi chỉnh source, chạy lại `npm.cmd run build` trước khi khởi động production. Launcher kiểm tra sự tồn tại của build, không tự đoán source đã thay đổi. `PORT`, `HOST` và `NEXT_PUBLIC_SITE_URL` phải thống nhất. `/api/health` trả HTTP 200 `{"status":"ok"}` khi database truy cập được; khi database lỗi trả lỗi không chứa secret.

## CMS và quyền

- **SUPER_ADMIN:** toàn quyền, quản lý người dùng và vai trò.
- **ADMIN:** nội dung, media, liên hệ, menu, cấu hình, SEO và nhật ký; không quản lý người dùng.
- **EDITOR:** nội dung, media và hộp thư liên hệ.
- **AUTHOR:** chỉ quản lý bài viết và media của mình.

Quyền được kiểm tra lại ở API cho từng thao tác. Không dựa vào việc ẩn nút. Tài khoản bị khóa, đổi quyền hoặc đổi mật khẩu sẽ mất các phiên cũ. Không cho khóa/hạ quyền Super Admin hoạt động cuối cùng.

Nội dung có `DRAFT`, `PUBLISHED`, `HIDDEN`; ngày đăng trong tương lai chưa xuất hiện công khai. Xóa chuyển vào thùng rác và có thể khôi phục. Slug tự bỏ dấu tiếng Việt và phải duy nhất trong từng loại nội dung; nếu trùng CMS yêu cầu đổi slug.

TipTap hỗ trợ heading H1–H3, paragraph, bold, italic, underline, quote, list, table, link, image, YouTube và căn lề. Dùng thư viện media để chọn ảnh. Thông báo hỗ trợ URL tài liệu ngoài. Video sử dụng URL YouTube; không upload tệp video lớn. Album có nhiều ảnh và lightbox. Đội ngũ có nhóm Ban Giám hiệu/Giáo viên. Giới thiệu, lịch sử, tầm nhìn, sứ mệnh, cơ cấu, cơ sở vật chất, thành tích và thống kê sửa trong cấu hình.

Media kiểm tra nội dung ảnh qua Sharp, giới hạn 10 MB/40 triệu pixel, chuyển WEBP tối đa 2400px và tạo thumbnail. Binary nằm ngoài database. Không chấp nhận SVG/HTML/file thực thi. Ảnh đang được tham chiếu trong nội dung hoặc cấu hình không thể xóa. Alt text lưu trong media; khi chèn ảnh, có thể chọn thông tin ảnh trong thư viện.

Tìm kiếm nội dung công khai, lọc chuyên mục và phân trang 12 mục. SEO title, description, canonical và Open Graph theo nội dung; `sitemap.xml`, `robots.txt`, schema School/Article/Event. `admin` không index. Form liên hệ có validation, honeypot và rate limit; lời nhắn nằm trong quản trị, không tự gửi email.

## Storage cho production

Mặc định file ở `uploads/` và được phục vụ qua `/api/media/<key>.webp` để ảnh upload có hiệu lực ngay trong production. Có thể đổi thư mục qua MEDIA_DIR.

Hỗ trợ S3-compatible qua cùng media layer:

```dotenv
STORAGE_DRIVER=s3
S3_ENDPOINT=https://YOUR_STORAGE_ENDPOINT
S3_REGION=auto
S3_BUCKET=YOUR_BUCKET
S3_ACCESS_KEY_ID=YOUR_KEY
S3_SECRET_ACCESS_KEY=YOUR_SECRET
```

Bucket có thể để private; server đọc file và phục vụ qua API. Quyền key chỉ cần đọc/ghi/xóa trong bucket tương ứng. Khi chuyển storage cần sao chép các object hiện có, không chỉ đổi biến.

## Deployment, tên miền và HTTPS

Chạy Node.js 22/24 trên VPS hoặc nền tảng hỗ trợ Node server, PostgreSQL và storage bền vững. Dùng PostgreSQL được quản lý hoặc riêng; `LOCAL_DATABASE=false`. Không dùng filesystem tạm của serverless cho media/database.

1. Cấu hình DATABASE_URL, AUTH_SECRET, SETUP_TOKEN tạm để thiết lập, MEDIA_DIR hoặc S3.
2. Đặt HOST=0.0.0.0, PORT=3000, NEXT_PUBLIC_SITE_URL=https://ten-mien-cua-ban và COOKIE_SECURE=true.
3. `npm ci`, `npm run db:migrate`, `npm run build`, `npm run start`.
4. Dùng service manager như systemd/PM2; không dựa vào terminal thủ công.
5. Trỏ DNS A/AAAA hoặc CNAME theo nhà cung cấp. Reverse proxy terminate HTTPS với chứng chỉ tự gia hạn. Đặt website URL và canonical trong cấu hình bằng đúng tên miền chuẩn.
6. Chọn www hoặc non-www, redirect 301 tên miền phụ về tên miền chuẩn tại reverse proxy. Không hard-code domain trong source.

Mẫu Nginx cho phần proxy (tự thay tên miền và cấu hình TLS theo hosting):

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 15m;
}
```

Rate limit trong app dùng địa chỉ socket và bucket theo email cho login, không tin X-Forwarded-For từ client. Với nhiều người dùng sau cùng một reverse proxy, cấu hình thêm rate limit theo IP ở proxy và điều chỉnh giới hạn ứng dụng theo lưu lượng thực tế. Đừng mở database local ra internet. Việc đăng ký tên miền giáo dục phụ thuộc quy định của nhà đăng ký.

## Backup và restore

Sao lưu database bằng công cụ PostgreSQL tương thích phiên bản server:

```powershell
pg_dump --format=custom --host=127.0.0.1 --port=54329 --username=school --file=school.backup school
```

Lệnh hỏi mật khẩu; không lưu password trong script. Với PostgreSQL riêng, thay host/port/user. Database cục bộ Windows có pg_dump/pg_restore trong `node_modules/@embedded-postgres/windows-x64/native/bin` (dùng đường dẫn ổ ASCII tạm nếu thư mục có dấu).

Khôi phục vào database mới đã tạo:

```powershell
pg_restore --host=127.0.0.1 --port=5432 --username=school --dbname=school_restored --no-owner school.backup
```

Dừng thao tác ghi, sao lưu thư mục `uploads/` vào nơi an toàn cùng bản database. Khi restore, đặt file media trở lại đúng MEDIA_DIR rồi đổi DATABASE_URL sang database đã phục hồi, chạy migration và khởi động. Với S3, bật versioning/lifecycle và sao lưu object theo hướng dẫn provider. Sao lưu `.env` bằng kho bí mật có kiểm soát riêng. Không sao chép `data/postgres` khi database đang chạy thay cho `pg_dump`.

Kiểm tra restore định kỳ vào môi trường khác trước khi tin cậy backup. Không ghi đè dữ liệu thật khi thử khôi phục.

## Kiểm thử

Khởi động production server rồi chạy:

```powershell
npm.cmd test
node tests/browser.mjs
```

Test tích hợp tạo dữ liệu tạm có ID riêng, kiểm tra API/RBAC/CSRF/CRUD/publish/media/search/SEO/contact/logout và dọn ở `finally`. **Chỉ chạy trên database kiểm thử/cục bộ, không chạy trên production đang phục vụ người dùng.** Test trình duyệt dùng Chrome; đặt BROWSER_EXECUTABLE nếu cài ở đường dẫn khác. Ảnh kiểm tra ở `test-results/`, không commit. Rate limit login vẫn áp dụng cho tests; chạy lặp quá nhanh có thể cần chờ hết cửa sổ 10 phút.

## Cấu trúc

`pages/`: SSR website, routes admin, API, sitemap/robots; `components/`: public/admin/editor/media; `lib/`: models, database, validation, security, storage; `database/`: migration schema; `scripts/`: environment, database runtime, preview và tạo admin; `tests/`: kiểm thử tích hợp và browser. Thiết kế dữ liệu và phạm vi ở `docs/architecture.md`.
#   w e d  
 