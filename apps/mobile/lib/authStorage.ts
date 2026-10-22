import AsyncStorage from "@react-native-async-storage/async-storage";

/** Login "Remember Me" choice: "1" (default) or "0". See mobileSession. */
export const REMEMBER_CHOICE_KEY = "sriNarayana.rememberChoice";

const AUTH_STORAGE_KEYS = [
  "sriNarayana.rememberedSession",
  "sriNarayana.auth",
  "sriNarayana.user",
  "sriNarayana.role",
  "sriNarayana.dashboardPath",
  "rememberMe",
  "authUser",
  "userRole",
  "dashboardPath",
  "selectedRole",
  "mobileSession",
  // Login "Remember Me" choice (see mobileSession). Cleared on logout so
  // every sign-in starts from a fresh, default-remembered choice.
  "sriNarayana.rememberChoice"
];

export async function clearMobileAuthStorage() {
  await AsyncStorage.multiRemove(AUTH_STORAGE_KEYS);

  const keys = await AsyncStorage.getAllKeys();
  const staleKeys = keys.filter((key) => (
    key.startsWith("firebase:authUser") ||
    key.includes("firebase:authUser") ||
    key.includes("sriNarayana") ||
    key.includes("rememberedSession") ||
    key.includes("mobileSession")
  ));

  if (staleKeys.length > 0) {
    await AsyncStorage.multiRemove(staleKeys);
  }
}
