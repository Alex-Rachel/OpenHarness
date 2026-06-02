import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { getFileDiff } from "@/core/git/git-operations";
import { getSvnFileDiff } from "@/core/vcs/svn-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/:workspaceId/codebases/:codebaseId/git/diff?path=...&staged=true
 * Get diff for a specific file.
 * Supports both Git and SVN codebases via VCS type dispatch.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const staged = url.searchParams.get("staged") === "true";

  if (!path) {
    return NextResponse.json(
      { error: "Missing 'path' query parameter" },
      { status: 400 },
    );
  }

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

  if (!isSvn && !isGitRepository(codebase.repoPath)) {
    return NextResponse.json(
      { error: "Not a valid git repository" },
      { status: 400 },
    );
  }

  try {
    // VCS dispatch: SVN does not have a staging concept; ignore `staged`
    const diff = isSvn
      ? getSvnFileDiff(codebase.repoPath, path)
      : await getFileDiff(codebase.repoPath, path, staged);

    return NextResponse.json({
      diff,
      path,
      staged,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get diff",
      },
      { status: 500 },
    );
  }
}
