import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { createCommit } from "@/core/git/git-operations";
import { svnCommit } from "@/core/vcs/svn-utils";
import { requireVcsCapability } from "@/core/vcs";

export const dynamic = "force-dynamic";

/**
 * POST /api/workspaces/:wId/codebases/:cId/vcs/commit
 * Unified commit endpoint — dispatches based on vcsType.
 *
 * Body: { message: string, files?: string[] }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;
  const body = await request.json();
  const { message, files } = body as { message?: string; files?: string[] };

  if (!message || !message.trim()) {
    return NextResponse.json(
      { success: false, error: "Commit message is required" },
      { status: 400 },
    );
  }

  const system = getRoutaSystem();

  const guard = await requireVcsCapability(codebaseId, "commit", system.codebaseStore);
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
      const commitFiles = files && files.length > 0 ? files : [];
      if (commitFiles.length === 0) {
        return NextResponse.json(
          { success: false, error: "SVN commit requires at least one file path" },
          { status: 400 },
        );
      }
      const revision = svnCommit(codebase.repoPath, commitFiles, message.trim());
      return NextResponse.json({
        success: true,
        id: `r${revision}`,
        message: message.trim(),
      });
    }

    const sha = await createCommit(codebase.repoPath, message, files);

    return NextResponse.json({
      success: true,
      id: sha,
      message: message.trim(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create commit",
      },
      { status: 500 },
    );
  }
}
