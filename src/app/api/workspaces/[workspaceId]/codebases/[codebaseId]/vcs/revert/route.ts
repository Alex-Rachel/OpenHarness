import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { discardChanges } from "@/core/git/git-operations";
import { svnRevert } from "@/core/vcs/svn-utils";
import { requireVcsCapability } from "@/core/vcs";

export const dynamic = "force-dynamic";

/**
 * POST /api/workspaces/:wId/codebases/:cId/vcs/revert
 * Unified revert endpoint — discard local changes.
 *
 * Body: { files: string[], confirm: boolean }
 * - Git: git checkout -- <files>
 * - SVN: svn revert <files>
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;
  const body = await request.json();
  const { files, confirm } = body as { files?: string[]; confirm?: boolean };

  if (!files || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid 'files' array in request body" },
      { status: 400 },
    );
  }

  if (confirm !== true) {
    return NextResponse.json(
      { success: false, error: "Revert requires explicit confirmation" },
      { status: 400 },
    );
  }

  const system = getRoutaSystem();
  const workspace = await system.workspaceStore.get(workspaceId);
  if (!workspace) {
    return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 404 });
  }

  const codebase = await system.codebaseStore.get(codebaseId);
  if (!codebase) {
    return NextResponse.json({ success: false, error: "Codebase not found" }, { status: 404 });
  }

  const isSvn = codebase.vcsType === "svn";

  if (!isSvn && !isGitRepository(codebase.repoPath)) {
    return NextResponse.json(
      { success: false, error: "Not a valid git repository" },
      { status: 400 },
    );
  }

  try {
    if (isSvn) {
      svnRevert(codebase.repoPath, files);
    } else {
      await discardChanges(codebase.repoPath, files);
    }

    return NextResponse.json({
      success: true,
      reverted: files,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to revert changes",
      },
      { status: 500 },
    );
  }
}
