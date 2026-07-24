import "server-only";

type RateLimitStore = {
  [key: string]: { count: number; resetAt: number };
};

const store: RateLimitStore = {};

function getMinuteKey(key: string): string {
  const now = new Date();
  return `${key}_${now.getUTCFullYear()}_${now.getUTCMonth()}_${now.getUTCDate()}_${now.getUTCHours()}_${now.getUTCMinutes()}`;
}

function getHourKey(key: string): string {
  const now = new Date();
  return `${key}_${now.getUTCFullYear()}_${now.getUTCMonth()}_${now.getUTCDate()}_${now.getUTCHours()}`;
}

function getDayKey(key: string): string {
  const now = new Date();
  return `${key}_${now.getUTCFullYear()}_${now.getUTCMonth()}_${now.getUTCDate()}`;
}

export async function checkRateLimit(params: {
  key: string;
  maxRequests: number;
  windowMinutes: number;
}): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const windowKey = getMinuteKey(params.key);
  const entry = store[windowKey];
  const resetAt = new Date(Date.now() + params.windowMinutes * 60 * 1000);

  if (!entry || Date.now() > entry.resetAt) {
    store[windowKey] = { count: 1, resetAt: Date.now() + params.windowMinutes * 60 * 1000 };
    return { allowed: true, remaining: params.maxRequests - 1, resetAt };
  }

  if (entry.count >= params.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: new Date(entry.resetAt) };
  }

  entry.count++;
  return { allowed: true, remaining: params.maxRequests - entry.count, resetAt };
}

export async function checkDailyRateLimit(params: {
  key: string;
  maxRequests: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  const dayKey = getDayKey(params.key);
  const entry = store[dayKey];
  const resetAt = new Date();
  resetAt.setHours(23, 59, 59, 999);

  if (!entry || Date.now() > entry.resetAt) {
    store[dayKey] = { count: 1, resetAt: resetAt.getTime() };
    return { allowed: true, remaining: params.maxRequests - 1 };
  }

  if (entry.count >= params.maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: params.maxRequests - entry.count };
}

export function resetRateLimiter(): void {
  Object.keys(store).forEach((key) => delete store[key]);
}
