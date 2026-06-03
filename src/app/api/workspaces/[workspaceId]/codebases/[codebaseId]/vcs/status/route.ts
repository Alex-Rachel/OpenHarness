import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { getSvnStatus } from "@/core/vcs/svn-utils";
import { requireVcsCapability } from "@/core/vcs";
import type { VcsStatus, VcsStatusEntry, VcsStatusCode } from "@/core/vcs/vcs-unified-types";
import { gitExec } from "@/core/utils/safe-exec";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/:wId/codebases/:cId/vcs/status
 * Unified status endpoint — dispatches based on vcsType.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;

  const system = getRoutaSystem();

  const guard = await requireVcsCapability(codebaseId, "fileBrowse", system.codebaseStore);
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
      const svnStatus = getSvnStatus(codebase.repoPath);
      const status: VcsStatus = {
        modified: mapSvnEntries(svnStatus.modified),
        added: mapSvnEntries(svnStatus.added),
        deleted: mapSvnEntries(svnStatus.deleted),
        untracked: mapSvnEntries(svnStatus.untracked),
        missing: mapSvnEntries(svnStatus.missing),
        conflicted: mapSvnEntries(svnStatus.conflicted),
      };
      return NextResponse.json(status);
    }

    // Git — use git status --porcelain
    const output = gitExec(
      ["status", "--porcelain", "--untracked-files=all"],
      { cwd: codebase.repoPath },
    );

    const status = parseGitPorcelain(output);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get status" },
      { status: 500 },
    );
  }
}

/** Map SVN status entries to unified VcsStatusEntry */
function mapSvnEntries(
  entries: Array<{ path: string; statusCode: string; propertyStatusCode: string }>,
): VcsStatusEntry[] {
  return entries.map((e) => ({
    path: e.path,
    status: svnCodeToStatus(e.statusCode),
    rawCode: e.statusCode,
  }));
}

const SVN_CODE_MAP: Record<string, VcsStatusCode> = {
  M: "modified",
  A: "added",
  D: "deleted",
  "?": "untracked",
  "!": "missing",
  C: "conflicted",
  R: "renamed",
};

function svnCodeToStatus(code: string): VcsStatusCode {
  return SVN_CODE_MAP[code] ?? "modified";
}

/** Parse git status --porcelain output into VcsStatus */
function parseGitPorcelain(output: string): VcsStatus {
  const status: VcsStatus = {
    modified: [],
    added: [],
    deleted: [],
    untracked: [],
    missing: [],
    conflicted: [],
  };

  const staged: VcsStatusEntry[] = [];

  if (!output.trim()) return { ...status, staged };

  for (const line of output.split("\n")) {
    if (!line) continue;

    const x = line[0]; // index status
    const y = line[1]; // working tree status
    const path = line.substring(3);

    // Staged changes (index)
    if (x === "M" || x === "A" || x === "D" || x === "R") {
      staged.push({
        path,
        status: gitCodeToStatus(x),
        rawCode: x,
      });
    }

    // Working tree changes
    if (y === "M") {
      status.modified.push({ path, status: "modified", rawCode: y });
    } else if (y === "D") {
      status.deleted.push({ path, status: "deleted", rawCode: y });
    } else if (y === "?") {
      status.untracked.push({ path, status: "untracked", rawCode: y });
    } else if (y === "A") {
      status.added.push({ path, status: "added", rawCode: y });
    } else if (y === "U" || y === "C") {
      status.conflicted.push({ path, status: "conflicted", rawCode: y });
    }

    // Untracked when both X and Y are ?
    if (x === "?" && y === "?") {
      // Already added above
    }
  }

  return { ...status, staged };
}

function gitCodeToStatus(code: string): VcsStatusCode {
  const map: Record<string, VcsStatusCode> = {
    M: "modified",
    A: "added",
    D: "deleted",
    R: "renamed",
    C: "copied",
    T: "typechange",
    "?": "untracked",
    U: "conflicted",
  };
  return map[code] ?? "modified";
}
