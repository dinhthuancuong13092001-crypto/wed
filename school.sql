-- Cơ sở dữ liệu website trường học: PostgreSQL.
-- Nhập vào database đã tạo bằng pgAdmin hoặc psql:
-- psql --host=127.0.0.1 --port=5432 --username=school --dbname=school --set=ON_ERROR_STOP=1 --file=school.sql
-- Database cục bộ của dự án dùng cổng mặc định 54329.
-- File chứa cấu trúc bảng và cấu hình ban đầu, không phải bản sao lưu dữ liệu.
-- Tạo quản trị viên tại /admin/setup. Không tạo tài khoản hoặc bài viết mẫu.
-- Chạy lại không ghi đè cấu hình đã lưu.
-- Nguồn: database/schema.sql và database/initial-settings.json.
-- Khi nguồn thay đổi, cần cập nhật file này.

BEGIN;
SELECT pg_advisory_xact_lock(720261);

CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS roles(name text PRIMARY KEY CHECK(name IN ('SUPER_ADMIN','ADMIN','EDITOR','AUTHOR')));
INSERT INTO roles VALUES ('SUPER_ADMIN'),('ADMIN'),('EDITOR'),('AUTHOR') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text NOT NULL UNIQUE, password_hash text NOT NULL, role text NOT NULL REFERENCES roles(name), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,slug text NOT NULL UNIQUE,excerpt text NOT NULL DEFAULT '',content text NOT NULL DEFAULT '',cover text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'PUBLISHED' CHECK(status IN ('DRAFT','PUBLISHED','HIDDEN')),author_id uuid REFERENCES users(id),category_id uuid, data jsonb NOT NULL DEFAULT '{}',views integer NOT NULL DEFAULT 0,published_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz);
DO $$ DECLARE tbl text; BEGIN FOREACH tbl IN ARRAY ARRAY['posts','announcements','events','albums','videos','teachers','pages'] LOOP
EXECUTE format('CREATE TABLE IF NOT EXISTS %I (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,slug text NOT NULL UNIQUE,excerpt text NOT NULL DEFAULT '''',content text NOT NULL DEFAULT '''',cover text NOT NULL DEFAULT '''',status text NOT NULL DEFAULT ''DRAFT'' CHECK(status IN (''DRAFT'',''PUBLISHED'',''HIDDEN'')),author_id uuid REFERENCES users(id),category_id uuid REFERENCES categories(id) ON DELETE SET NULL,data jsonb NOT NULL DEFAULT ''{}'',views integer NOT NULL DEFAULT 0,published_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz)',tbl);
EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(status,published_at DESC) WHERE deleted_at IS NULL',tbl||'_public',tbl);
EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(author_id)',tbl||'_author',tbl);
END LOOP; END $$;
CREATE TABLE IF NOT EXISTS media(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,alt text NOT NULL DEFAULT '',url text NOT NULL,thumbnail text NOT NULL,mime text NOT NULL,size integer NOT NULL,storage_key text NOT NULL,author_id uuid REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS album_images(album_id uuid REFERENCES albums(id) ON DELETE CASCADE,media_id uuid REFERENCES media(id) ON DELETE RESTRICT,sort_order integer NOT NULL DEFAULT 0,PRIMARY KEY(album_id,media_id));
CREATE TABLE IF NOT EXISTS post_categories(post_id uuid REFERENCES posts(id) ON DELETE CASCADE,category_id uuid REFERENCES categories(id) ON DELETE CASCADE,PRIMARY KEY(post_id,category_id));
CREATE TABLE IF NOT EXISTS site_settings(key text PRIMARY KEY,value text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS seo_settings(key text PRIMARY KEY,value text NOT NULL);
CREATE TABLE IF NOT EXISTS menus(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS menu_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),menu_id uuid REFERENCES menus(id) ON DELETE CASCADE,parent_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,label text NOT NULL,url text NOT NULL,sort_order integer NOT NULL DEFAULT 0,visible boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS contact_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,email text NOT NULL DEFAULT '',phone text NOT NULL DEFAULT '',subject text NOT NULL,message text NOT NULL,status text NOT NULL DEFAULT 'UNREAD',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_logs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid REFERENCES users(id) ON DELETE SET NULL,action text NOT NULL,entity text NOT NULL,entity_id text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rate_limits(key text PRIMARY KEY,count integer NOT NULL DEFAULT 1,expires_at timestamptz NOT NULL);
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;

INSERT INTO site_settings(key, value) VALUES
    ('schoolName', 'Trường TH, THCS, THPT Đinh Tiên Hoàng'),
    ('logo', '/logo-truong.jpg')
ON CONFLICT(key) DO NOTHING;

COMMIT;
