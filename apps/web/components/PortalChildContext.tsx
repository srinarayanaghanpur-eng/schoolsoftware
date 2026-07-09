"use client";

import { useAuth } from "@/components/AuthProvider";
import { auth } from "@sri-narayana/shared/firebase/client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type LinkedStudent = { id: string; name: string; className: string; section?: string };

type PortalChildContextValue = {
  children: LinkedStudent[];
  selectedChildId: string;
  selectedChild: LinkedStudent | null;
  loading: boolean;
  switchChild: (studentId: string) => void;
  refreshChildren: () => Promise<void>;
};

const PortalChildContext = createContext<PortalChildContextValue>({
  children: [],
  selectedChildId: "",
  selectedChild: null,
  loading: true,
  switchChild: () => {},
  refreshChildren: async () => {},
});

const STORAGE_KEY = "portal_selected_child";

export function PortalChildProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [allChildren, setAllChildren] = useState<LinkedStudent[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchChildren = useCallback(async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/portal/children", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok && data.children?.length > 0) {
        setAllChildren(data.children);
        const stored = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
        const storedId = stored && data.children.some((c: LinkedStudent) => c.id === stored) ? stored : data.children[0].id;
        setSelectedChildId(storedId);
        if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEY, storedId);
      } else {
        setAllChildren([]);
        setSelectedChildId("");
      }
    } catch {
      setAllChildren([]);
      setSelectedChildId("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "checking") return;
    if (status === "authenticated") {
      void fetchChildren();
      return;
    }
    setLoading(false);
    setAllChildren([]);
    setSelectedChildId("");
  }, [fetchChildren, status]);

  const switchChild = useCallback((studentId: string) => {
    setSelectedChildId(studentId);
    if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEY, studentId);
  }, []);

  const selectedChild = allChildren.find((c) => c.id === selectedChildId) ?? null;

  return (
    <PortalChildContext.Provider
      value={{
        children: allChildren,
        selectedChildId,
        selectedChild,
        loading,
        switchChild,
        refreshChildren: fetchChildren,
      }}
    >
      {children}
    </PortalChildContext.Provider>
  );
}

export function usePortalChild() {
  return useContext(PortalChildContext);
}
