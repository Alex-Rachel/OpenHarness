import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { getFileDiff } from "@/core/git/git-operations";
import { getSvnFileDiff, getSvnDiff } from "@/core/vcs/svn-utils";
import { requireVcsCapability } from "@/core/vcs";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/:wId/codebases/:cId/vcs/diff
 * Unified diff endpoint — dispatches based on vcsType.
 *
 * Query params:
 *   path   — specific file path (optional; if omitted, returns full diff)
 *   staged — include staged changes (Git-only, ignored for SVN)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;
  const url = new URL(request.url);
  const filePath = url.searchParams.get("path") || undefined;
  const staged = url.searchParams.get("staged") === "true";

  const system = getRoutaSystem();

  const guard = await requireVcsCapability(codebaseId, "diff", system.codebaseStore);
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.errorMessage }, { status: 400 });
  }

  const codebase = guard.codebase!;
  const isSvn = codebase.vcsType === "svn";

  if (!isSvn && !isGitRepository(codebase.repoPath)) {
    return NextResponse.json({ error: "Not a valid git repository" }, { status: 400 });
  }

  try {
    let diff: string;

    if (isSvn) {
      diff = filePath
        ? getSvnFileDiff(codebase.repoPath, filePath)
        : getSvnDiff(codebase.repoPath);
    } else {
      diff = filePath
        ? await getFileDiff(codebase.repoPath, filePath, staged)
        : await getFileDiff(codebase.repoPath, "", staged);
    }

    return NextResponse.json({ diff, path: filePath ?? "all", staged });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get diff" },
      { status: 500 },
    );
  }
}
