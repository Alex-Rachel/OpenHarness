/**
 * VCS module — unified re-export for version control abstraction.
 *
 * Provides VCS type detection, capability mapping, and type definitions.
 */

export type { VcsType, VcsCapability } from "./vcs-types";
export { isVcsType, isVcsCapability } from "./vcs-types";
export { detectVcsType, resolveVcsType } from "./vcs-detect";
export { getVcsCapabilities, hasVcsCapability } from "./vcs-capabilities";
export { requireVcsCapability } from "./vcs-guard";
export type { VcsGuardResult } from "./vcs-guard";
