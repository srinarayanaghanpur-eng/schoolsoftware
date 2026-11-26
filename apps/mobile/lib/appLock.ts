import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppLockConfig } from "./api";

const CACHE_KEY = "@sri-narayana:app-lock-config";

function isConfig(value: unknown): value is AppLockConfig {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AppLockConfig>;
  return typeof record.enabled === "boolean" && Array.isArray(record.roles);
}

export async function readCachedAppLock(): Promise<AppLockConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeCachedAppLock(config: AppLockConfig): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(config)).catch(() => undefined);
}
