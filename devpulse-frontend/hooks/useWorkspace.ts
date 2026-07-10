"use client";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook that gets the user's current workspace.
 * Auto-selects the first available workspace (usually the personal workspace).
 * Returns { workspaceId, workspace, isLoading, error, switchWorkspace }
 */
export function useWorkspace() {
  const {
    data: workspaces,
    isLoading,
    error,
  } = trpc.workspaces.listMine.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const currentId = trpc.workspaces.listMine.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const activeWorkspace = useMemo(() => {
    if (!workspaces || workspaces.length === 0) return null;
    return workspaces[0];
  }, [workspaces]);

  return {
    workspaceId: activeWorkspace?.id ?? 1, // fallback to 1 for dev
    workspace: activeWorkspace,
    workspaces: workspaces ?? [],
    isLoading,
    error,
  };
}
