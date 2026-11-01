// スマホの写真・スクショを、文字が読める大きさのまま軽くする（アップロード前にブラウザ内で処理）。
// 長辺2400px・約400万画素以内。縦長のスクショは幅1080pxを保つ（タイムテーブルの小さな文字が潰れないように）。
// iPhone の Safari は canvas から WebP を作れない（PNG になって重くなる）ため JPEG に統一する。
export const MAX_LONG_SIDE = 2400;
export const MAX_PIXELS = 4_000_000;
export const MIN_TALL_WIDTH = 1080;
export const JPEG_QUALITY = 0.85;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export function targetSize(width: number, height: number): { width: number; height: number } {
  let scale = Math.min(1, MAX_LONG_SIDE / Math.max(width, height), Math.sqrt(MAX_PIXELS / (width * height)));
  if (height > width && width * scale < MIN_TALL_WIDTH) scale = Math.min(1, Math.max(scale, MIN_TALL_WIDTH / width));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* 下の方法で読み直す */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("この画像は読み込めませんでした。スクリーンショットやJPEGで保存し直してからお試しください。");
  }
}

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  contentType: "image/jpeg";
}

export async function compressImage(file: File): Promise<CompressedImage> {
  const image = await decode(file);
  try {
    const size = targetSize(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像を変換できませんでした。");
    ctx.fillStyle = "#ffffff"; // 透明部分は白にする（JPEGは透明を持てない）
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image.source, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("画像を変換できませんでした。"))), "image/jpeg", JPEG_QUALITY),
    );
    // もともと小さいJPEGは、そのままの方が軽くきれい
    if (file.type === "image/jpeg" && size.width === image.width && blob.size >= file.size) {
      return { blob: file, width: image.width, height: image.height, contentType: "image/jpeg" };
    }
    return { blob, ...size, contentType: "image/jpeg" };
  } finally {
    image.close();
  }
}
