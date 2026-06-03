import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { pullCommits } from "@/core/git/git-operations";
import { svnUpdate } from "@/core/vcs/svn-utils";
import { requireVcsCapability } from "@/core/vcs";

export const dynamic = "force-dynamic";

/**
 * POST /api/workspaces/:wId/codebases/:cId/vcs/update
 * Unified update endpoint — git pull or svn update.
 *
 * Body (Git): { remote?: string, branch?: string }
 * Body (SVN): {} (no params needed)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;
  const body = await request.json();
  const { remote, branch } = body as { remote?: string; branch?: string };

  const system = getRoutaSystem();

  const guard = await requireVcsCapability(codebaseId, "pullUpdate", system.codebaseStore);
  if (!guard.allowed) {
    return NextResponse.json({ success: false, error: guard.errorMessage }, { status: 400 });
  }

  const codebase = guard.codebase!;
  const isSvn = codebase.vcsType === "svn";

  if (!isSvn && !isGitRepository(codebase.repoPath)) {
    return NextResponse.json(
      { success: false, error: "Not a valid git repository" },
      { status: 400 },
    );
  }

  try {
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
        error: error instanceof Error ? error.message : "Failed to update",
      },
      { status: 500 },
    );
  }
}
