/**
 * VCS module — unified re-export for version control abstraction.
 *
 * Provides VCS type detection, capability mapping, type definitions,
 * and unified cross-VCS data structures.
 */

export type { VcsType, VcsCapability } from "./vcs-types";
export { isVcsType, isVcsCapability } from "./vcs-types";
export { detectVcsType, resolveVcsType } from "./vcs-detect";
export { getVcsCapabilities, hasVcsCapability } from "./vcs-capabilities";
export { requireVcsCapability } from "./vcs-guard";
export type { VcsGuardResult } from "./vcs-guard";

// Unified cross-VCS types
export type {
  VcsLogEntry,
  VcsRef,
  VcsGraphEdge,
  VcsCommitDetail,
  VcsFileChangeStatus,
  VcsFileChange,
  VcsStatusCode,
  VcsStatusEntry,
  VcsStatus,
  VcsRepoInfo,
  VcsBlameLine,
  VcsLogQuery,
  VcsLogPage,
} from "./vcs-unified-types";
