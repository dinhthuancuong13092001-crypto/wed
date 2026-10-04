import { prepareEnvironment, startDatabase, migrate } from "./runtime.mjs";
let db;
try {
  await prepareEnvironment();
  db = await startDatabase();
  await migrate();
  console.log("Database migration thành công. Không tạo nội dung mẫu.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (db) await db.stop();
}
