import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { stageFiles } from "@/core/git/git-operations";
import { requireVcsCapability } from "@/core/vcs";
import { existsSync } from "fs";

export const dynamic = "force-dynamic";

/**
 * POST /api/workspaces/:workspaceId/codebases/:codebaseId/git/stage
 * Stage files in the Git index
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;
  const body = await request.json();
  const { files } = body as { files?: string[] };

  if (!files || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid 'files' array in request body" },
      { status: 400 },
    );
  }

  const system = getRoutaSystem();

  // VCS capability guard — reject if the codebase is not a Git repository
  const guard = await requireVcsCapability(codebaseId, "stageUnstage", system.codebaseStore);
  if (!guard.allowed) {
    return NextResponse.json(
      { success: false, error: guard.errorMessage },
      { status: 400 },
    );
  }

  const codebase = guard.codebase!;

  // Check if repo path exists
  if (!existsSync(codebase.repoPath)) {
    return NextResponse.json(
      { success: false, error: `Repository path does not exist: ${codebase.repoPath}` },
      { status: 400 },
    );
  }

  if (!isGitRepository(codebase.repoPath)) {
    return NextResponse.json(
      { success: false, error: `Not a valid git repository: ${codebase.repoPath}` },
      { status: 400 },
    );
  }

  try {
    await stageFiles(codebase.repoPath, files);

    return NextResponse.json({
      success: true,
      staged: files,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to stage files";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
