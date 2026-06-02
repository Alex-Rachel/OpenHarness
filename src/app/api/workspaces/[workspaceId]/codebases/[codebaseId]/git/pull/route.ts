import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { pullCommits } from "@/core/git/git-operations";
import { svnUpdate } from "@/core/vcs/svn-utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/workspaces/:workspaceId/codebases/:codebaseId/git/pull
 * Pull commits from remote (Git) or update working copy (SVN).
 * Supports both Git and SVN codebases via VCS type dispatch.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;
  const body = await request.json();
  const { remote, branch } = body as { remote?: string; branch?: string };

  const system = getRoutaSystem();
  const workspace = await system.workspaceStore.get(workspaceId);

  if (!workspace) {
    return NextResponse.json(
      { success: false, error: "Workspace not found" },
      { status: 404 },
    );
  }

  const codebase = await system.codebaseStore.get(codebaseId);

  if (!codebase) {
    return NextResponse.json(
      { success: false, error: "Codebase not found" },
      { status: 404 },
    );
  }

  const isSvn = codebase.vcsType === "svn";

  if (!isSvn && !isGitRepository(codebase.repoPath)) {
    return NextResponse.json(
      { success: false, error: "Not a valid git repository" },
      { status: 400 },
    );
  }

  try {
    // VCS dispatch: SVN update ignores remote/branch parameters
    if (isSvn) {
      const result = svnUpdate(codebase.repoPath);
      return NextResponse.json({
        success: true,
        revision: result.revision,
      });
    }

    await pullCommits(codebase.repoPath, remote, branch);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to pull commits",
      },
      { status: 500 },
    );
  }
}
