import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "@sri-narayana:face-device-id";

function randomId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

export async function getFaceDeviceId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored && stored.length >= 8) return stored;
  } catch {
    // Fall through to a fresh ID; the server will register it again.
  }
  const created = `mobile-${randomId()}`;
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, created);
  } catch {
    // Registration still works for this session if storage is unavailable.
  }
  return created;
}

export function getFaceDeviceName(): string {
  const model = Device.modelName ?? "Android device";
  return `${model} · ${Platform.OS === "ios" ? "iOS" : "Android"}`;
}

export function getFaceAppVersion(): string | undefined {
  const version = Constants.expoConfig?.version;
  return typeof version === "string" && version.trim() ? version : undefined;
}
