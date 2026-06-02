/**
 * /api/workspaces/[workspaceId]/codebases - Codebases for a workspace.
 *
 * GET  /api/workspaces/:workspaceId/codebases → List codebases
 * POST /api/workspaces/:workspaceId/codebases → Add codebase
 */

import { NextRequest, NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { createCodebase, type VcsType, type CodebaseSourceType } from "@/core/models/codebase";
import { normalizeLocalRepoPath, validateRepoInput, isBareGitRepository } from "@/core/git";
import { resolveVcsType } from "@/core/vcs/vcs-detect";
import { getVcsCapabilities } from "@/core/vcs/vcs-capabilities";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const system = getRoutaSystem();

  const codebases = await system.codebaseStore.listByWorkspace(workspaceId);

  // Attach capabilities to each codebase for client-side feature gating
  const enriched = codebases.map((cb) => ({
    ...cb,
    capabilities: Array.from(getVcsCapabilities(cb.vcsType)),
  }));

  return NextResponse.json({ codebases: enriched });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const body = await request.json();
  const repoPathInput = typeof body?.repoPath === "string" ? body.repoPath : "";
  const { branch, label } = body;

  if (!repoPathInput) {
    return NextResponse.json({ error: "repoPath is required" }, { status: 400 });
  }

  const repoPath = normalizeLocalRepoPath(repoPathInput);
  const validation = validateRepoInput(repoPath);
  if (!validation.valid || validation.isGitHub) {
    return NextResponse.json(
      { error: validation.error ?? "repoPath must point to a local directory" },
      { status: 400 },
    );
  }

  const vcsType: VcsType = resolveVcsType(validation.vcsType);

  // Check if this is a bare repository (Git-only check)
  if (vcsType === "git" && isBareGitRepository(repoPath)) {
    return NextResponse.json(
      {
        error: "Cannot add a bare git repository as a codebase",
        suggestion: "Bare repos don't have a working directory and can't be synced or checked out. Clone a regular working copy instead, or use this repo as a worktree source for task-specific branches."
      },
      { status: 400 }
    );
  }

  const system = getRoutaSystem();

  // Check for duplicate repoPath within this workspace
  const existing = await system.codebaseStore.findByRepoPath(workspaceId, repoPath);
  if (existing) {
    return NextResponse.json(
      { error: "Codebase with this repoPath already exists in the workspace" },
      { status: 409 }
    );
  }

  // If first codebase in workspace, set as default
  const count = await system.codebaseStore.countByWorkspace(workspaceId);
  const isDefault = count === 0;

  // Derive sourceType from vcsType for non-GitHub sources
  const sourceType: CodebaseSourceType = vcsType === "svn" ? "svn"
    : vcsType === "none" ? "none"
    : "local";

  const codebase = createCodebase({
    id: crypto.randomUUID(),
    workspaceId,
    repoPath,
    branch,
    label,
    isDefault,
    sourceType,
    vcsType,
  });

  try {
    await system.codebaseStore.add(codebase);
  } catch (err) {
    console.error("[codebases POST] store.add failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save codebase" },
      { status: 500 }
    );
  }

  return NextResponse.json({ codebase }, { status: 201 });
}
