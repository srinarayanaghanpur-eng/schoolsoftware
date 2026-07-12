import AsyncStorage from "@react-native-async-storage/async-storage";

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
  "mobileSession"
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
