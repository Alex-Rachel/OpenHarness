import { useState, useCallback } from "react";
import { desktopAwareFetch } from "@/client/utils/diagnostics";

type VcsType = "git" | "svn" | "none";

interface UseVcsOperationsProps {
  workspaceId: string;
  codebaseId: string;
  /** VCS type — determines which API routes to call */
  vcsType?: VcsType | null;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface VcsOperationResult {
  success: boolean;
  error?: string;
}

/**
 * Unified VCS operations hook — reuses existing /git/* routes for both Git and SVN.
 *
 * IMPORTANT: This project uses ROUTA_RUST_BACKEND_URL which proxies ALL /api/*
 * requests to the Rust backend via Next.js rewrites (beforeFiles). The Rust backend
 * only knows about /git/* routes, which already have SVN dispatch built in.
 * So we reuse /git/* routes for SVN too — they internally check vcsType and branch
 * to the correct implementation.
 */
export function useVcsOperations({
  workspaceId,
  codebaseId,
  vcsType: _vcsType,
  onSuccess,
  onError,
}: UseVcsOperationsProps) {
  const [loading, setLoading] = useState(false);

  const isSvn = _vcsType === "svn";
  const baseUrl = `/api/workspaces/${encodeURIComponent(workspaceId)}/codebases/${encodeURIComponent(codebaseId)}/git`;

  const stageFiles = useCallback(async (files: string[]): Promise<VcsOperationResult> => {
    // SVN has no staging — commit works directly on file selection
    if (isSvn) return { success: true };

    setLoading(true);
    try {
      const res = await desktopAwareFetch(`${baseUrl}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, confirm: true }),
      });
      const data = await res.json();
      if (data.success) { onSuccess?.(); return { success: true }; }
      onError?.(data.error || "Failed to stage files");
      return { success: false, error: data.error };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to stage files";
      onError?.(msg);
      return { success: false, error: msg };
    } finally { setLoading(false); }
  }, [isSvn, baseUrl, onSuccess, onError]);

  const unstageFiles = useCallback(async (_files: string[]): Promise<VcsOperationResult> => {
    if (isSvn) return { success: true };

    setLoading(true);
    try {
      const res = await desktopAwareFetch(`${baseUrl}/unstage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: _files }),
      });
      const data = await res.json();
      if (data.success) { onSuccess?.(); return { success: true }; }
      onError?.(data.error || "Failed to unstage files");
      return { success: false, error: data.error };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to unstage files";
      onError?.(msg);
      return { success: false, error: msg };
    } finally { setLoading(false); }
  }, [isSvn, baseUrl, onSuccess, onError]);

  const createCommit = useCallback(async (message: string, files?: string[]): Promise<VcsOperationResult & { sha?: string }> => {
    setLoading(true);
    try {
      const res = await desktopAwareFetch(`${baseUrl}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, files }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess?.();
        return { success: true, sha: data.sha || data.id };
      }
      onError?.(data.error || "Failed to create commit");
      return { success: false, error: data.error };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to create commit";
      onError?.(msg);
      return { success: false, error: msg };
    } finally { setLoading(false); }
  }, [baseUrl, onSuccess, onError]);

  const discardChanges = useCallback(async (files: string[]): Promise<VcsOperationResult> => {
    setLoading(true);
    try {
      // /git/discard already dispatches to svn revert for SVN codebases
      const res = await desktopAwareFetch(`${baseUrl}/discard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, confirm: true }),
      });
      const data = await res.json();
      if (data.success) { onSuccess?.(); return { success: true }; }
      onError?.(data.error || "Failed to discard changes");
      return { success: false, error: data.error };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to discard changes";
      onError?.(msg);
      return { success: false, error: msg };
    } finally { setLoading(false); }
  }, [baseUrl, onSuccess, onError]);

  const getCommits = useCallback(async (limit = 20): Promise<any[]> => {
    try {
      const res = await desktopAwareFetch(`${baseUrl}/commits?limit=${limit}`, { cache: "no-store" });
      const data = await res.json();
      return data.commits || [];
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to get commits";
      onError?.(msg);
      return [];
    }
  }, [baseUrl, onError]);

  const getFileDiff = useCallback(async (filePath: string): Promise<string | null> => {
    try {
      const params = new URLSearchParams({ path: filePath });
      // /git/diff already dispatches to svn diff for SVN codebases
      const res = await desktopAwareFetch(`${baseUrl}/diff?${params}`, { cache: "no-store" });
      const data = await res.json();
      return data.diff || null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to get file diff";
      onError?.(msg);
      return null;
    }
  }, [baseUrl, onError]);

  const getCommitDiff = useCallback(async (commitSha: string): Promise<string | null> => {
    try {
      const params = new URLSearchParams({});
      const res = await desktopAwareFetch(`${baseUrl}/commits/${encodeURIComponent(commitSha)}/diff?${params}`, { cache: "no-store" });
      const data = await res.json();
      return data.diff || null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to get commit diff";
      onError?.(msg);
      return null;
    }
  }, [baseUrl, onError]);

  const pullCommits = useCallback(async (remote = "origin", branch?: string): Promise<VcsOperationResult> => {
    setLoading(true);
    try {
      // /git/pull already dispatches to svn update for SVN codebases
      const res = await desktopAwareFetch(`${baseUrl}/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remote, branch }),
      });
      const data = await res.json();
      if (data.success) { onSuccess?.(); return { success: true }; }
      onError?.(data.error || "Failed to update");
      return { success: false, error: data.error };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to update";
      onError?.(msg);
      return { success: false, error: msg };
    } finally { setLoading(false); }
  }, [baseUrl, onSuccess, onError]);

  const rebaseBranch = useCallback(async (_onto: string): Promise<VcsOperationResult> => {
    if (isSvn) return { success: false, error: "SVN does not support rebase" };
    setLoading(true);
    try {
      const res = await desktopAwareFetch(`${baseUrl}/rebase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onto: _onto }),
      });
      const data = await res.json();
      if (data.success) { onSuccess?.(); return { success: true }; }
      onError?.(data.error || "Failed to rebase");
      return { success: false, error: data.error };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to rebase";
      onError?.(msg);
      return { success: false, error: msg };
    } finally { setLoading(false); }
  }, [isSvn, baseUrl, onSuccess, onError]);

  const resetBranch = useCallback(async (_to: string, _mode: "soft" | "hard", _confirm = false): Promise<VcsOperationResult> => {
    if (isSvn) return { success: false, error: "SVN does not support reset" };
    setLoading(true);
    try {
      const res = await desktopAwareFetch(`${baseUrl}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: _to, mode: _mode, confirm: _confirm }),
      });
      const data = await res.json();
      if (data.success) { onSuccess?.(); return { success: true }; }
      onError?.(data.error || "Failed to reset");
      return { success: false, error: data.error };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to reset";
      onError?.(msg);
      return { success: false, error: msg };
    } finally { setLoading(false); }
  }, [isSvn, baseUrl, onSuccess, onError]);

  const exportChanges = useCallback(async (files?: string[], format: "patch" | "diff" = "patch"): Promise<VcsOperationResult & { patch?: string; filename?: string }> => {
    if (isSvn) return { success: false, error: "SVN export not yet supported" };
    setLoading(true);
    try {
      const res = await desktopAwareFetch(`${baseUrl}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, format }),
      });
      const data = await res.json();
      if (data.success) return { success: true, patch: data.patch, filename: data.filename };
      onError?.(data.error || "Failed to export");
      return { success: false, error: data.error };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to export";
      onError?.(msg);
      return { success: false, error: msg };
    } finally { setLoading(false); }
  }, [isSvn, baseUrl, onError]);

  return {
    stageFiles,
    unstageFiles,
    createCommit,
    discardChanges,
    getCommits,
    getFileDiff,
    getCommitDiff,
    pullCommits,
    rebaseBranch,
    resetBranch,
    exportChanges,
    loading,
  };
}
