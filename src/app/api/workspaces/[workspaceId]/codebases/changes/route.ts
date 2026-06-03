import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { getRepoChanges, isBareGitRepository, isGitRepository } from "@/core/git";
import { getSvnStatus } from "@/core/vcs/svn-utils";
import { detectVcsType, resolveVcsType } from "@/core/vcs/vcs-detect";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const system = getRoutaSystem();
  const codebases = await system.codebaseStore.listByWorkspace(workspaceId);

  const repos = codebases.map((codebase) => {
    const label = codebase.label ?? codebase.repoPath.split("/").pop() ?? codebase.repoPath;
    // Prefer stored vcsType; fall back to runtime filesystem detection
    const rawVcsType = codebase.vcsType ?? detectVcsType(codebase.repoPath);
    const vcsType = resolveVcsType(rawVcsType);

    try {
      if (!codebase.repoPath) {
        throw new Error("Missing repository path");
      }

      // SVN: use svn status for file changes
      if (vcsType === "svn") {
        const svnStatus = getSvnStatus(codebase.repoPath);
        const allFiles = svnStatus.all.map((entry) => {
          const statusMap: Record<string, string> = {
            M: "modified",
            A: "added",
            D: "deleted",
            "?": "untracked",
            "!": "missing",
            C: "conflicted",
            R: "renamed",
          };
          return {
            path: entry.path,
            status: statusMap[entry.statusCode] ?? "modified",
          };
        });

        return {
          codebaseId: codebase.id,
          repoPath: codebase.repoPath,
          label,
          branch: codebase.branch ?? "trunk",
          vcsType: "svn" as const,
          status: {
            clean: svnStatus.all.length === 0,
            ahead: 0,
            behind: 0,
            modified: svnStatus.modified.length,
            untracked: svnStatus.untracked.length,
          },
          files: allFiles,
        };
      }

      // Git: existing logic
      if (!isGitRepository(codebase.repoPath)) {
        throw new Error("Repository is missing or not a git repository");
      }
      if (isBareGitRepository(codebase.repoPath)) {
        throw new Error("This codebase points to a bare git repository (no working directory). Bare repos can't show changes. Use a worktree or regular clone instead.");
      }

      const changes = getRepoChanges(codebase.repoPath);
      return {
        codebaseId: codebase.id,
        repoPath: codebase.repoPath,
        label,
        branch: changes.branch,
        vcsType: "git" as const,
        status: changes.status,
        files: changes.files,
      };
    } catch (error) {
      return {
        codebaseId: codebase.id,
        repoPath: codebase.repoPath,
        label,
        branch: codebase.branch ?? "unknown",
        vcsType,
        status: {
          clean: true,
          ahead: 0,
          behind: 0,
          modified: 0,
          untracked: 0,
        },
        files: [] as Array<{ path: string; status: string }>,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  return NextResponse.json({ workspaceId, repos });
}
