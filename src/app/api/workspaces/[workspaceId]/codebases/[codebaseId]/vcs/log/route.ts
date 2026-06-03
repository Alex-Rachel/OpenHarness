import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { getCommitList, type CommitInfo } from "@/core/git/git-operations";
import { getSvnLog } from "@/core/vcs/svn-utils";
import type { VcsLogEntry } from "@/core/vcs/vcs-unified-types";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/:wId/codebases/:cId/vcs/log
 * Unified log endpoint — dispatches to git log or svn log based on vcsType.
 *
 * Query params:
 *   limit  — number of entries (default 20)
 *   skip   — offset for pagination (Git-only)
 *   search — text search filter
 *   branches — comma-separated branch filter (Git-only)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);
  const skip = parseInt(url.searchParams.get("skip") || "0", 10);
  const search = url.searchParams.get("search") || undefined;
  const branchesParam = url.searchParams.get("branches") || undefined;
  const branches = branchesParam ? branchesParam.split(",").filter(Boolean) : undefined;

  const system = getRoutaSystem();
  const workspace = await system.workspaceStore.get(workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const codebase = await system.codebaseStore.get(codebaseId);
  if (!codebase) {
    return NextResponse.json({ error: "Codebase not found" }, { status: 404 });
  }

  const isSvn = codebase.vcsType === "svn";

  if (!isSvn && !isGitRepository(codebase.repoPath)) {
    return NextResponse.json({ error: "Not a valid git repository" }, { status: 400 });
  }

  try {
    if (isSvn) {
      const entries = getSvnLog(codebase.repoPath, limit);
      const commits: VcsLogEntry[] = entries.map((entry) => ({
        id: `r${entry.revision}`,
        shortId: `r${entry.revision}`,
        author: entry.author,
        date: entry.date,
        message: entry.message,
        summary: entry.message.split("\n")[0].substring(0, 80),
        parents: entry.revision > 1 ? [`r${entry.revision - 1}`] : [],
      }));

      return NextResponse.json({
        commits,
        total: commits.length,
        hasMore: commits.length === limit,
      });
    }

    // Git
    const since = search || undefined;
    const commits = await getCommitList(codebase.repoPath, { limit, since });

    const mapped: VcsLogEntry[] = commits.map((c: CommitInfo) => ({
      id: c.sha,
      shortId: c.shortSha,
      author: c.authorName,
      authorEmail: c.authorEmail,
      date: c.authoredAt,
      message: c.message,
      summary: c.summary,
    }));

    return NextResponse.json({
      commits: mapped,
      total: mapped.length,
      hasMore: mapped.length === limit,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get log" },
      { status: 500 },
    );
  }
}
