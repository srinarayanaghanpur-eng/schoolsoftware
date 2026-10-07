/**
 * SelectedChild — one shared "which child am I looking at" choice for every
 * parent screen. The provider lives in app/parent/_layout.tsx so the choice
 * survives tab switches; each screen validates it against its own linked
 * list and falls back to the first linked child.
 *
 * The context default is a no-op (not null) so legacy flat routes that
 * render a parent screen outside the group never crash.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { PortalStudent } from "./api";

type SelectedChildContextValue = {
  selectedId: string | undefined;
  select: (id: string) => void;
};

const SelectedChildContext = createContext<SelectedChildContextValue>({
  selectedId: undefined,
  select: () => undefined
});

export function SelectedChildProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const select = useCallback((id: string) => setSelectedId(id), []);
  const value = useMemo(() => ({ selectedId, select }), [selectedId, select]);
  return <SelectedChildContext.Provider value={value}>{children}</SelectedChildContext.Provider>;
}

/**
 * Resolve the shared choice against this screen's linked list. Returns the
 * chosen id when still linked, otherwise the first linked child (or
 * undefined while loading). Pass the result straight into useParentSummary /
 * useParentHomework / useParentPayments / useParentAttendance.
 */
export function useSelectedChildId(linked: PortalStudent[]): string | undefined {
  const { selectedId, select } = useContext(SelectedChildContext);
  return useMemo(() => {
    if (linked.length === 0) return undefined;
    if (selectedId && linked.some((child) => child.id === selectedId)) return selectedId;
    return linked[0].id;
  }, [linked, selectedId]);
}

export function useSelectChild(): (id: string) => void {
  return useContext(SelectedChildContext).select;
}

/** Raw shared choice (undefined = no choice yet → server default). */
export function useSelectedChildRaw(): string | undefined {
  return useContext(SelectedChildContext).selectedId;
}
