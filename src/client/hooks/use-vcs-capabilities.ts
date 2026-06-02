"use client";

import { useMemo } from "react";
import type { VcsType, VcsCapability } from "@/core/vcs/vcs-types";
import { getVcsCapabilities } from "@/core/vcs/vcs-capabilities";
import type { CodebaseData } from "./use-workspaces";

/**
 * React hook that returns the VCS capability set for a given codebase.
 *
 * Uses memoization — the Set is recomputed only when vcsType changes.
 * Defaults to Git capabilities when vcsType is undefined (backward compat).
 *
 * @param codebase - The codebase object, codebase ID, or undefined
 * @returns Set<VcsCapability> for the codebase's VCS type
 */
export function useVcsCapabilities(
  codebase: CodebaseData | undefined | null,
): Set<VcsCapability> {
  const vcsType = codebase?.vcsType;

  return useMemo(() => {
    // If the API already provided capabilities, use those
    if (codebase?.capabilities?.length) {
      return new Set(codebase.capabilities as VcsCapability[]);
    }
    // Otherwise compute from vcsType
    return getVcsCapabilities(vcsType as VcsType | undefined);
  }, [vcsType, codebase?.capabilities]);
}

/**
 * Convenience hook: check a single capability.
 */
export function useHasVcsCapability(
  codebase: CodebaseData | undefined | null,
  capability: VcsCapability,
): boolean {
  const caps = useVcsCapabilities(codebase);
  return caps.has(capability);
}
