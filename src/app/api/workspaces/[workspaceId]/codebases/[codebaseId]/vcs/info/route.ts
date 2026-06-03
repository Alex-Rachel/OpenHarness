import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { getSvnInfo } from "@/core/vcs/svn-utils";
import { requireVcsCapability } from "@/core/vcs";
import type { VcsRepoInfo } from "@/core/vcs/vcs-unified-types";
import { gitExec } from "@/core/utils/safe-exec";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/:wId/codebases/:cId/vcs/info
 * Unified repository info endpoint.
 *
 * SVN: structured svn info output
 * Git: current branch, remote URL, last commit
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;

  const system = getRoutaSystem();

  const guard = await requireVcsCapability(codebaseId, "info", system.codebaseStore);
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.errorMessage }, { status: 400 });
  }

  const codebase = guard.codebase!;
  const isSvn = codebase.vcsType === "svn";

  if (!isSvn && !isGitRepository(codebase.repoPath)) {
    return NextResponse.json({ error: "Not a valid git repository" }, { status: 400 });
  }

  try {
    if (isSvn) {
      const info = getSvnInfo(codebase.repoPath);

      const result: VcsRepoInfo = {
        vcsType: "svn",
        repoUrl: info.repoRootUrl,
        revision: info.revision,
        lastChangedAuthor: info.lastChangedAuthor,
        lastChangedDate: info.lastChangedDate,
        lastChangedRevision: info.lastChangedRevision,
      };

      return NextResponse.json(result);
    }

    // Git — gather branch, remote, last commit
    const branch = gitExec(["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: codebase.repoPath,
    });

    let remoteUrl: string | undefined;
    try {
      remoteUrl = gitExec(["remote", "get-url", "origin"], {
        cwd: codebase.repoPath,
      });
    } catch {
      // No remote configured
    }

    let lastCommit: VcsRepoInfo["lastCommit"];
    try {
      const logOutput = gitExec(
        ["log", "-1", "--format=%H%n%an%n%aI%n%s"],
        { cwd: codebase.repoPath },
      );

      const [sha, author, date, message] = logOutput.trim().split("\n");
      lastCommit = { sha, author, date, message };
    } catch {
      // Empty repository
    }

    const result: VcsRepoInfo = {
      vcsType: "git",
      repoUrl: remoteUrl?.trim() || undefined,
      branch: branch?.trim() || undefined,
      lastCommit,
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get repo info" },
      { status: 500 },
    );
  }
}
