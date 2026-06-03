"use client";

import { useMemo } from "react";
import type { VcsType } from "@/core/vcs/vcs-types";
import { RealGitAdapter } from "../git-log/real-adapter";
import { RealSvnLogAdapter } from "./real-svn-adapter";
import { MockGitAdapter } from "../git-log/mock-adapter";
import { MockSvnLogAdapter } from "./mock-adapter";
import type { VcsLogAdapter } from "./types";

interface UseVcsLogOptions {
  /** VCS type — determines which adapter to use */
  vcsType?: VcsType | null;
  /** Use mock adapter for development */
  mock?: boolean;
  /** Required for real SVN adapter to build correct API URLs */
  workspaceId?: string;
  /** Required for real SVN adapter to build correct API URLs */
  codebaseId?: string;
}

/**
 * Hook that returns the appropriate VcsLogAdapter based on vcsType.
 *
 * - "git" → RealGitAdapter
 * - "svn" → RealSvnLogAdapter (needs workspaceId + codebaseId)
 * - mock: true → MockGitAdapter or MockSvnLogAdapter
 */
export function useVcsLogAdapter(options: UseVcsLogOptions = {}): VcsLogAdapter {
  const { vcsType, mock, workspaceId, codebaseId } = options;

  return useMemo(() => {
    if (mock) {
      return (vcsType === "svn" ? new MockSvnLogAdapter() : new MockGitAdapter()) as VcsLogAdapter;
    }

    if (vcsType === "svn" && workspaceId && codebaseId) {
      return new RealSvnLogAdapter({ workspaceId, codebaseId });
    }

    return new RealGitAdapter() as unknown as VcsLogAdapter;
  }, [vcsType, mock, workspaceId, codebaseId]);
}
