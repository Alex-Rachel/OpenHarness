"use client";

import React, { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaces } from "@/client/hooks/use-workspaces";
import { DesktopAppShell } from "@/client/components/desktop-app-shell";
import { WorkspaceSwitcher } from "@/client/components/workspace-switcher";
import { useTranslation } from "@/i18n";
import { WorkspaceContextProvider, useWorkspaceContext } from "./workspace-context";

function WorkspaceLayoutShell({
  children,
  workspaceId,
}: {
  children: React.ReactNode;
  workspaceId: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { workspaces, loading, createWorkspace, deleteWorkspace, titleBarRight } = useWorkspaceContext();

  const workspace = workspaces.find((w) => w.id === workspaceId);
  const activeWorkspaceTitle = workspace?.title ?? (workspaceId === "default" ? t.workspace.defaultWorkspace : workspaceId);

  const handleWorkspaceSelect = useCallback((nextWorkspaceId: string) => {
    router.push(`/workspace/${nextWorkspaceId}/kanban`);
  }, [router]);

  const handleWorkspaceCreate = useCallback(async (title: string) => {
    const result = await createWorkspace(title);
    if (result) {
      router.push(`/workspace/${result.id}/kanban`);
    }
  }, [router, createWorkspace]);

  const handleWorkspaceDelete = useCallback(async (workspaceId: string) => {
    await deleteWorkspace(workspaceId);
    // Navigate to home after deleting the active workspace
    router.push("/");
  }, [router, deleteWorkspace]);

  return (
    <DesktopAppShell
      workspaceId={workspaceId}
      workspaceTitle={activeWorkspaceTitle}
      titleBarRight={titleBarRight}
      workspaceSwitcher={(
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={workspaceId}
          activeWorkspaceTitle={activeWorkspaceTitle}
          onSelect={handleWorkspaceSelect}
          onCreate={handleWorkspaceCreate}
          onDelete={handleWorkspaceDelete}
          loading={loading}
          compact
          desktop
        />
      )}
    >
      {children}
    </DesktopAppShell>
  );
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const rawWorkspaceId = params.workspaceId as string;
  const workspaceId =
    rawWorkspaceId === "__placeholder__" && typeof window !== "undefined"
      ? (window.location.pathname.match(/^\/workspace\/([^/]+)/)?.[1] ?? rawWorkspaceId)
      : rawWorkspaceId;

  const workspacesHook = useWorkspaces();

  return (
    <WorkspaceContextProvider value={workspacesHook}>
      <WorkspaceLayoutShell workspaceId={workspaceId}>
        {children}
      </WorkspaceLayoutShell>
    </WorkspaceContextProvider>
  );
}
