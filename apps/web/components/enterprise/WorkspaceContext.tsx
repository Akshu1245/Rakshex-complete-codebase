"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";

interface WorkspaceCtx {
  workspaceId: number;
  workspaceName: string;
  isLoading: boolean;
  workspaces: Array<{ id: number; name: string; slug: string }>;
}

const WorkspaceContext = createContext<WorkspaceCtx>({
  workspaceId: 0,
  workspaceName: "No workspace",
  isLoading: false,
  workspaces: [],
});

export function useEnterpriseWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { workspaces, workspace: activeWorkspace, isLoading } = useWorkspace();

  const value = useMemo<WorkspaceCtx>(() => {
    return {
      workspaceId: activeWorkspace?.id ?? 0,
      workspaceName: activeWorkspace?.name ?? "No workspace",
      isLoading,
      workspaces: workspaces.map((w) => ({ id: w.id, name: w.name, slug: w.slug })),
    };
  }, [workspaces, activeWorkspace, isLoading]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
