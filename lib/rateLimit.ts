const uploadCounts = new Map<string, { count: number; resetAt: number }>();
const UPLOAD_LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkUploadRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = uploadCounts.get(userId);
  if (!entry) {
    uploadCounts.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (now > entry.resetAt) {
    uploadCounts.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= UPLOAD_LIMIT) return false;
  entry.count++;
  return true;
}
