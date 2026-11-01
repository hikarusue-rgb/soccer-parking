// 画像・PDFを Cloud Storage に保存し、表示用のURLを返す（保存先: mss/{学年}/files/{ID}.{拡張子}）
import { storage } from "./firebase";
import type { GradeCode } from "./grade";
import { MAX_FILE_BYTES, compressImage } from "./imageCompress";
import type { Attachment } from "./types";

export function newFileId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** ファイル名から拡張子を外した表示名（あとで変更できる） */
export function defaultLabel(name: string): string {
  const base = name.replace(/\.[A-Za-z0-9]{1,5}$/, "").trim();
  return (base || "資料").slice(0, 60);
}

export type UploadStage = "compressing" | "uploading";

export async function uploadFile(
  grade: GradeCode,
  file: File,
  order: number,
  onProgress: (stage: UploadStage, percent: number) => void,
): Promise<Attachment> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) throw new Error("画像かPDFを選んでください。");

  let blob: Blob = file;
  let contentType = "application/pdf";
  let width: number | undefined;
  let height: number | undefined;
  if (isImage) {
    onProgress("compressing", 0);
    const compressed = await compressImage(file);
    blob = compressed.blob;
    contentType = compressed.contentType;
    width = compressed.width;
    height = compressed.height;
  }
  if (blob.size >= MAX_FILE_BYTES) throw new Error(`ファイルが大きすぎます（${formatBytes(blob.size)}）。15MB未満にしてください。`);

  const id = newFileId();
  const path = `mss/${grade}/files/${id}.${isPdf ? "pdf" : "jpg"}`;
  const s = await storage();
  const task = s.uploadBytesResumable(s.ref(s.instance, path), blob, { contentType, customMetadata: { originalName: file.name.slice(0, 120) } });
  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress("uploading", snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0),
      (error) => reject(new Error(/unauthorized|permission/i.test(error.code) ? "アップロードの権限がありません（コーチとしてログインしてください）。" : "アップロードできませんでした。通信状態を確認してください。")),
      () => resolve(),
    );
  });
  const url = await s.getDownloadURL(task.snapshot.ref);
  return {
    id, label: defaultLabel(file.name), type: isPdf ? "pdf" : "image", contentType, size: blob.size,
    ...(width ? { width, height } : {}), path, url, order, uploadedAt: Date.now(),
  };
}

/** Storage のファイルを削除する（見つからない場合は削除済みとして扱う） */
export async function deleteFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const s = await storage();
  await Promise.all(paths.map(async (path) => {
    try {
      await s.deleteObject(s.ref(s.instance, path));
    } catch (error) {
      if ((error as { code?: string }).code !== "storage/object-not-found") console.error("ファイルを削除できませんでした:", path);
    }
  }));
}
