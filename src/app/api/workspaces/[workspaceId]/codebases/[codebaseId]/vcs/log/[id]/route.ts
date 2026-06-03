import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { getCommitDiff } from "@/core/git/git-operations";
import { getSvnLogVerboseByRevision, getSvnRevisionDiff } from "@/core/vcs/svn-utils";
import type { VcsCommitDetail, VcsFileChange } from "@/core/vcs/vcs-unified-types";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/:wId/codebases/:cId/vcs/log/:id
 * Unified commit/revision detail — dispatches based on vcsType.
 *
 * For Git: id is a SHA → git show --stat + diff
 * For SVN: id is "r42" → svn log -v -r 42 + svn diff -c 42
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string; id: string }> },
) {
  const { workspaceId, codebaseId, id } = await params;

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
      // Parse revision from "r42" or bare "42"
      const revStr = id.startsWith("r") ? id.substring(1) : id;
      const revision = parseInt(revStr, 10);
      if (isNaN(revision)) {
        return NextResponse.json({ error: "Invalid revision format" }, { status: 400 });
      }

      const entries = getSvnLogVerboseByRevision(codebase.repoPath, String(revision));
      const entry = entries[0];

      if (!entry) {
        return NextResponse.json({ error: `Revision ${revision} not found` }, { status: 404 });
      }

      const patch = getSvnRevisionDiff(codebase.repoPath, revision);

      const files: VcsFileChange[] = entry.files.map((f) => {
        const statusMap: Record<string, VcsFileChange["status"]> = {
          A: "added",
          M: "modified",
          D: "deleted",
          R: "renamed",
        };
        return {
          path: f.path,
          previousPath: f.copyFromPath,
          status: statusMap[f.action] ?? "modified",
        };
      });

      const detail: VcsCommitDetail = {
        id: `r${entry.revision}`,
        shortId: `r${entry.revision}`,
        author: entry.author,
        date: entry.date,
        message: entry.message,
        files,
        patch: patch || undefined,
      };

      return NextResponse.json(detail);
    }

    // Git
    const diff = await getCommitDiff(codebase.repoPath, id);

    // Parse files from diff output
    const files: VcsFileChange[] = parseFilesFromGitDiff(diff);

    const detail: VcsCommitDetail = {
      id,
      shortId: id.substring(0, 7),
      author: "", // Will be filled by git show if needed
      date: "",
      message: "",
      files,
      patch: diff,
    };

    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get commit detail" },
      { status: 500 },
    );
  }
}

/** Extract file list from a unified diff string. */
function parseFilesFromGitDiff(diff: string): VcsFileChange[] {
  if (!diff) return [];
  const files: VcsFileChange[] = [];
  const lines = diff.split("\n");

  for (const line of lines) {
    // Match diff --git a/path b/path
    const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (match) {
      const oldPath = match[1];
      const newPath = match[2];
      files.push({
        path: newPath,
        previousPath: oldPath !== newPath ? oldPath : undefined,
        status: oldPath !== newPath ? "renamed" : "modified",
      });
    }
    // Match new file mode
    if (line.startsWith("new file mode ")) {
      if (files.length > 0) {
        files[files.length - 1].status = "added";
        files[files.length - 1].previousPath = undefined;
      }
    }
    // Match deleted file mode
    if (line.startsWith("deleted file mode ")) {
      if (files.length > 0) {
        files[files.length - 1].status = "deleted";
      }
    }
  }

  return files;
}
