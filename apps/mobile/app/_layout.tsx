import { Stack } from "expo-router";
import { OptimizedMobileLayout } from "@/lib/OptimizedAppLayout";
import { MobileSessionProvider } from "@/lib/mobileSession";

export default function Layout() {
  return (
    <OptimizedMobileLayout>
      <MobileSessionProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </MobileSessionProvider>
    </OptimizedMobileLayout>
  );
}
