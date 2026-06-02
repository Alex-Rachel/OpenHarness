"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import type { UseWorkspacesReturn } from "@/client/hooks/use-workspaces";

interface WorkspaceContextValue extends UseWorkspacesReturn {
  titleBarRight: React.ReactNode;
  setTitleBarRight: (node: React.ReactNode) => void;
  clearTitleBarRight: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceContextProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: UseWorkspacesReturn;
}) {
  const [titleBarRight, setTitleBarRightState] = useState<React.ReactNode>(null);

  const setTitleBarRight = useCallback((node: React.ReactNode) => setTitleBarRightState(node), []);
  const clearTitleBarRight = useCallback(() => setTitleBarRightState(null), []);

  return (
    <WorkspaceContext.Provider value={{ ...value, titleBarRight, setTitleBarRight, clearTitleBarRight }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used within WorkspaceContextProvider");
  return ctx;
}
