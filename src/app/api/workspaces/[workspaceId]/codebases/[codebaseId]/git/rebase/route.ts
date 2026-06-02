import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { rebaseBranch } from "@/core/git/git-operations";
import { requireVcsCapability } from "@/core/vcs";

export const dynamic = "force-dynamic";

/**
 * POST /api/workspaces/:workspaceId/codebases/:codebaseId/git/rebase
 * Rebase current branch onto target branch
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;
  const body = await request.json();
  const { onto } = body as { onto?: string };

  if (!onto || !onto.trim()) {
    return NextResponse.json(
      { success: false, error: "Target branch 'onto' is required" },
      { status: 400 },
    );
  }

  const system = getRoutaSystem();

  // VCS capability guard — reject if the codebase is not a Git repository
  const guard = await requireVcsCapability(codebaseId, "rebase", system.codebaseStore);
  if (!guard.allowed) {
    return NextResponse.json(
      { success: false, error: guard.errorMessage },
      { status: 400 },
    );
  }

  const codebase = guard.codebase!;

  if (!isGitRepository(codebase.repoPath)) {
    return NextResponse.json(
      { success: false, error: "Not a valid git repository" },
      { status: 400 },
    );
  }

  try {
    await rebaseBranch(codebase.repoPath, onto);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to rebase branch",
      },
      { status: 500 },
    );
  }
}
