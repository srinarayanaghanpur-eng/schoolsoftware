import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FaceGallery } from "@/lib/faceApi";

const CACHE_PREFIX = "@sri-narayana:face-gallery:";

type CachedGallery = FaceGallery & {
  cachedAt: string;
  deviceId: string;
};

function key(deviceId: string) {
  return `${CACHE_PREFIX}${deviceId}`;
}

export async function readCachedFaceGallery(deviceId: string): Promise<FaceGallery | null> {
  try {
    const raw = await AsyncStorage.getItem(key(deviceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedGallery;
    if (
      parsed.deviceId !== deviceId ||
      !Array.isArray(parsed.candidates) ||
      typeof parsed.modelVersion !== "string"
    ) {
      return null;
    }
    return {
      enabled: parsed.enabled !== false,
      deviceStatus: parsed.deviceStatus ?? "pending",
      shared: parsed.shared === true,
      matchThreshold:
        typeof parsed.matchThreshold === "number" ? parsed.matchThreshold : 0.6,
      requireLiveness: parsed.requireLiveness !== false,
      modelVersion: parsed.modelVersion,
      candidates: parsed.candidates
    };
  } catch {
    return null;
  }
}

export async function writeCachedFaceGallery(deviceId: string, gallery: FaceGallery): Promise<void> {
  try {
    const payload: CachedGallery = {
      ...gallery,
      deviceId,
      cachedAt: new Date().toISOString()
    };
    await AsyncStorage.setItem(key(deviceId), JSON.stringify(payload));
  } catch {
    // Cache is best-effort; live recognition can still use the server response.
  }
}

export async function clearCachedFaceGallery(deviceId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(deviceId));
  } catch {
    // Best-effort.
  }
}
