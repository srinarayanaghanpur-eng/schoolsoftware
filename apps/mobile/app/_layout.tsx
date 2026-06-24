import { Stack } from "expo-router";
import { OptimizedMobileLayout } from "@/lib/OptimizedAppLayout";

export default function Layout() {
  return (
    <OptimizedMobileLayout>
      <Stack screenOptions={{ headerShown: false }} />
    </OptimizedMobileLayout>
  );
}
