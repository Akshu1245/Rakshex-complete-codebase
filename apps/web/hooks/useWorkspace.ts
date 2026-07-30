"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

const ACTIVE_WORKSPACE_KEY = "rakshex.activeWorkspaceId";

/**
 * Hook that gets the user's current workspace.
 * Persists the user's explicit selection and safely falls back to the first
 * available workspace when a membership is removed.
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

  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    if (stored && Number.isInteger(Number(stored)) && Number(stored) > 0) {
      setSelectedId(Number(stored));
    }
  }, []);

  const activeWorkspace = useMemo(() => {
    if (!workspaces || workspaces.length === 0) return null;
    return workspaces.find((workspace) => workspace.id === selectedId) ?? workspaces[0];
  }, [selectedId, workspaces]);

  useEffect(() => {
    if (!activeWorkspace) return;
    window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, String(activeWorkspace.id));
    if (selectedId !== activeWorkspace.id) setSelectedId(activeWorkspace.id);
  }, [activeWorkspace, selectedId]);

  const switchWorkspace = useCallback(
    (workspaceId: number) => {
      if (!workspaces?.some((workspace) => workspace.id === workspaceId)) return;
      window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, String(workspaceId));
      setSelectedId(workspaceId);
    },
    [workspaces],
  );

  return {
    workspaceId: activeWorkspace?.id ?? 0,
    workspace: activeWorkspace,
    workspaces: workspaces ?? [],
    isLoading,
    error,
    switchWorkspace,
  };
}
