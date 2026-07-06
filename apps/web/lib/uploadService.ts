/**
 * Local upload service — NO Firebase Storage.
 *
 * Firebase Storage requires the Blaze (paid) plan for new buckets, so uploads
 * through the Storage SDK hang forever on the Spark plan. Instead, files are
 * converted to compact data URLs and saved in the same Firestore document
 * fields that previously held Storage download URLs (photoURL, documentURLs,
 * proof URLs...). <img src> renders data URLs natively, so no caller changes.
 *
 * Size discipline (Firestore documents are capped at ~1MB):
 *  - Photos are compressed via canvas to ≤640px JPEG (~30–80KB typically).
 *  - Non-image files (PDFs etc.) are allowed up to 500KB raw (~670KB base64);
 *    larger files are rejected with a clear message.
 */

const PHOTO_MAX_DIMENSION = 640;
const PHOTO_JPEG_QUALITY = 0.75;
const RAW_FILE_LIMIT_BYTES = 500 * 1024;

function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

/** Downscale + re-encode an image to a small JPEG data URL. */
async function compressImageToDataUrl(file: File, onProgress?: (percent: number) => void): Promise<string> {
  onProgress?.(20);
  const originalDataUrl = await readFileAsDataUrl(file);
  onProgress?.(50);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The selected image could not be processed."));
    img.src = originalDataUrl;
  });

  const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return originalDataUrl; // very old browser — store as-is
  context.drawImage(image, 0, 0, width, height);
  onProgress?.(80);

  const compressed = canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
  onProgress?.(100);
  // Keep whichever encoding came out smaller (tiny PNG icons can grow as JPEG).
  return compressed.length < originalDataUrl.length ? compressed : originalDataUrl;
}

/**
 * "Upload" a file locally: returns a data URL string that callers save to
 * Firestore exactly where they used to save the Storage download URL.
 * The `path` parameter is kept for API compatibility (unused).
 */
export async function uploadFile(
  file: File,
  _path: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (file.type.startsWith("image/")) {
    return compressImageToDataUrl(file, onProgress);
  }

  if (file.size > RAW_FILE_LIMIT_BYTES) {
    throw new Error(
      `File is too large (${Math.round(file.size / 1024)}KB). Maximum is ${Math.round(RAW_FILE_LIMIT_BYTES / 1024)}KB — please compress the document or upload a smaller scan.`
    );
  }

  onProgress?.(30);
  const dataUrl = await readFileAsDataUrl(file);
  onProgress?.(100);
  return dataUrl;
}

/**
 * Deleting a locally-stored file is a no-op: the data URL lives inside the
 * Firestore document itself, so removing it from the document field (which
 * callers already do) is the actual delete.
 */
export async function deleteFile(_path: string): Promise<void> {
  return;
}

export function getStudentPhotoPath(admissionNumber: string, fileName: string): string {
  return `students/${admissionNumber}/photos/${fileName}`;
}

export function getDocumentPath(admissionNumber: string, fileName: string): string {
  return `students/${admissionNumber}/documents/${fileName}`;
}
