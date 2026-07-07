"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Permission, Role } from "@sri-narayana/shared";

export type AdminProfile = {
  uid: string;
  name: string;
  email?: string;
  role?: Role;
};

type AdminSessionValue = {
  profile: AdminProfile | null;
  role?: Role;
  permissions?: Permission[];
  loading: boolean;
  hasPermission: (permission: Permission) => boolean;
};

const AdminSessionContext = createContext<AdminSessionValue>({
  profile: null,
  role: undefined,
  permissions: undefined,
  loading: true,
  hasPermission: () => false
});

export function AdminSessionProvider({
  value,
  children
}: {
  value: AdminSessionValue;
  children: ReactNode;
}) {
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  return useContext(AdminSessionContext);
}
