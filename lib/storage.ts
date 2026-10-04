import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
const root = path.resolve(
  /* turbopackIgnore: true */ process.env.MEDIA_DIR || "uploads",
);
function localPath(key: string) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(key)) throw Error("Invalid storage key");
  return path.join(/* turbopackIgnore: true */ root, key);
}
function s3() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}
export async function putFile(key: string, data: Buffer, mime: string) {
  if (process.env.STORAGE_DRIVER === "s3") {
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: mime,
      }),
    );
  } else {
    await mkdir(root, { recursive: true });
    await writeFile(localPath(key), data);
  }
}
export async function getFile(key: string) {
  if (process.env.STORAGE_DRIVER === "s3") {
    const r = await s3().send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    );
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  return readFile(/* turbopackIgnore: true */ localPath(key));
}
export async function deleteFile(key: string) {
  if (process.env.STORAGE_DRIVER === "s3")
    await s3().send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    );
  else await unlink(localPath(key)).catch(() => {});
}
