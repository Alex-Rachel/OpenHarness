import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { svnAdd } from "@/core/vcs/svn-utils";
import { stageFiles } from "@/core/git/git-operations";
import { requireVcsCapability } from "@/core/vcs";

export const dynamic = "force-dynamic";

/**
 * POST /api/workspaces/:wId/codebases/:cId/vcs/add
 * Unified add endpoint — add files to version control.
 *
 * Body (SVN): { path: string } — single file
 * Body (Git): { files: string[] } — multiple files (stages them)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;
  const body = await request.json();
  const { path: singlePath, files } = body as { path?: string; files?: string[] };

  const system = getRoutaSystem();

  const guard = await requireVcsCapability(codebaseId, "add", system.codebaseStore);
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
      // SVN: add a single file
      if (!singlePath) {
        return NextResponse.json(
          { success: false, error: "Missing 'path' parameter for SVN add" },
          { status: 400 },
        );
      }
      svnAdd(codebase.repoPath, singlePath);
      return NextResponse.json({ success: true, added: [singlePath] });
    }

    // Git: stage files (git add)
    const toAdd = files && files.length > 0 ? files : (singlePath ? [singlePath] : []);
    if (toAdd.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files specified" },
        { status: 400 },
      );
    }
    await stageFiles(codebase.repoPath, toAdd);
    return NextResponse.json({ success: true, added: toAdd });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add files",
      },
      { status: 500 },
    );
  }
}
