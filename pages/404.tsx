import Link from "next/link";
import Head from "next/head";
export default function NotFound() {
  return (
    <main className="not-found">
      <Head>
        <title>404 – Không tìm thấy trang</title>
      </Head>
      <strong>404</strong>
      <h1>Không tìm thấy trang</h1>
      <p>Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.</p>
      <Link className="button" href="/">
        Quay về trang chủ
      </Link>
    </main>
  );
}
