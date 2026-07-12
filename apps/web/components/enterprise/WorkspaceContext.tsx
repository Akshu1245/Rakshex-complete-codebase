"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

interface WorkspaceCtx {
  workspaceId: number;
  workspaceName: string;
  isLoading: boolean;
  workspaces: Array<{ id: number; name: string; slug: string }>;
}

const WorkspaceContext = createContext<WorkspaceCtx>({
  workspaceId: 1,
  workspaceName: "Default",
  isLoading: false,
  workspaces: [],
});

export function useEnterpriseWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: workspaces, isLoading } = trpc.workspaces.listMine.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const value = useMemo<WorkspaceCtx>(() => {
    const active = workspaces?.[0];
    return {
      workspaceId: active?.id ?? 1,
      workspaceName: active?.name ?? "Default",
      isLoading,
      workspaces: (workspaces ?? []).map((w) => ({ id: w.id, name: w.name, slug: w.slug })),
    };
  }, [workspaces, isLoading]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
