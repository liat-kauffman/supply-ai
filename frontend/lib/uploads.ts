export const MAX_API_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_API_UPLOAD_LABEL = "4 MB";

export function isApiUploadTooLarge(file: File) {
  return file.size > MAX_API_UPLOAD_BYTES;
}
