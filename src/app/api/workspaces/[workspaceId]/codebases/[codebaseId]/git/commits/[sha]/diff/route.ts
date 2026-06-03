import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { getCommitDiff } from "@/core/git/git-operations";
import {
  getSvnLogVerboseByRevision,
  getSvnRevisionDiff,
} from "@/core/vcs/svn-utils";
import type { VcsFileChange } from "@/core/vcs/vcs-unified-types";

export const dynamic = "force-dynamic";

/** Map SVN changed-path action codes to VcsFileChangeStatus */
const SVN_ACTION_MAP: Record<string, VcsFileChange["status"]> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
};

/**
 * GET /api/workspaces/:workspaceId/codebases/:codebaseId/git/commits/:sha/diff?path=...
 * Get diff for a specific commit (optionally for a specific file).
 * Dispatches to Git or SVN based on the codebase's vcsType.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string; sha: string }> },
) {
  const { workspaceId, codebaseId, sha } = await params;
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || undefined;

  const system = getRoutaSystem();
  const workspace = await system.workspaceStore.get(workspaceId);

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 },
    );
  }

  const codebase = await system.codebaseStore.get(codebaseId);

  if (!codebase) {
    return NextResponse.json(
      { error: "Codebase not found" },
      { status: 404 },
    );
  }

  const isSvn = codebase.vcsType === "svn";

  // ─── SVN dispatch ──────────────────────────────────────────────────
  if (isSvn) {
    try {
      // sha is in the form "r42" — extract revision number
      const revMatch = sha.match(/^r(\d+)$/);
      if (!revMatch) {
        return NextResponse.json(
          { error: `Invalid SVN revision format: ${sha}` },
          { status: 400 },
        );
      }
      const revision = parseInt(revMatch[1], 10);

      const [entries, diff] = await Promise.all([
        getSvnLogVerboseByRevision(codebase.repoPath, String(revision)),
        getSvnRevisionDiff(codebase.repoPath, revision),
      ]);

      const entry = entries[0];
      if (!entry) {
        return NextResponse.json(
          { error: `SVN revision r${revision} not found` },
          { status: 404 },
        );
      }

      const files: VcsFileChange[] = entry.files.map((f) => ({
        path: f.path,
        previousPath: f.copyFromPath,
        status: SVN_ACTION_MAP[f.action] ?? "modified",
      }));

      return NextResponse.json({
        author: entry.author,
        date: entry.date,
        message: entry.message,
        files,
        diff: diff || "",
        sha,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to get SVN revision diff",
        },
        { status: 500 },
      );
    }
  }

  // ─── Git ───────────────────────────────────────────────────────────
  if (!isGitRepository(codebase.repoPath)) {
    return NextResponse.json(
      { error: "Not a valid git repository" },
      { status: 400 },
    );
  }

  try {
    const diff = await getCommitDiff(codebase.repoPath, sha, path);

    return NextResponse.json({
      diff,
      sha,
      path,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get commit diff",
      },
      { status: 500 },
    );
  }
}
