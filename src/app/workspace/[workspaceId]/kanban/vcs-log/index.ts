/**
 * VCS Log module — unified log panel for Git and SVN.
 *
 * Re-exports the main panel, adapters, and types.
 */

export { VcsLogPanel } from "./vcs-log-panel";
export { VcsLogToolbar } from "./vcs-log-toolbar";
export { SvnLogView } from "./svn-log-view";
export { VcsCommitDetailPanel } from "./vcs-commit-detail-panel";
export { RealSvnLogAdapter } from "./real-svn-adapter";
export { MockSvnLogAdapter } from "./mock-adapter";
export { useVcsLogAdapter } from "./use-vcs-log";
export type {
  VcsLogPanelProps,
  VcsLogAdapter,
  VcsLogQuery,
  VcsLogPage,
} from "./types";
