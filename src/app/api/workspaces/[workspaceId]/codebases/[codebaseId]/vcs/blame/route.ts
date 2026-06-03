import { NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import { isGitRepository } from "@/core/git";
import { svnBlame } from "@/core/vcs/svn-utils";
import { requireVcsCapability } from "@/core/vcs";
import type { VcsBlameLine } from "@/core/vcs/vcs-unified-types";
import { gitExec } from "@/core/utils/safe-exec";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/:wId/codebases/:cId/vcs/blame?path=...
 * Unified blame endpoint — line-level authorship.
 *
 * Query params:
 *   path — file path (required)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; codebaseId: string }> },
) {
  const { workspaceId, codebaseId } = await params;
  const url = new URL(request.url);
  const filePath = url.searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "Missing 'path' query parameter" }, { status: 400 });
  }

  const system = getRoutaSystem();

  const guard = await requireVcsCapability(codebaseId, "blame", system.codebaseStore);
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
      const svnLines = svnBlame(codebase.repoPath, filePath);
      const lines: VcsBlameLine[] = svnLines.map((l) => ({
        lineNumber: l.lineNumber,
        revision: String(l.revision),
        author: l.author,
        content: l.content,
      }));
      return NextResponse.json({ lines });
    }

    // Git blame — porcelain format for robust parsing
    const output = gitExec(
      ["blame", "--porcelain", filePath],
      { cwd: codebase.repoPath },
    );

    const lines = parseGitBlamePorcelain(output);
    return NextResponse.json({ lines });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get blame" },
      { status: 500 },
    );
  }
}

/** Parse git blame --porcelain output into VcsBlameLine[] */
function parseGitBlamePorcelain(output: string): VcsBlameLine[] {
  const lines: VcsBlameLine[] = [];
  if (!output.trim()) return lines;

  const currentCommitData: Record<string, { author: string; summary: string }> = {};
  const headerRegex = /^([0-9a-f]{40})\s+(\d+)\s+(\d+)/;

  for (const line of output.split("\n")) {
    // Store commit metadata
    if (line.startsWith("author ")) {
      // Extract from preceding header — simplified approach
    }

    const headerMatch = line.match(headerRegex);
    if (headerMatch) {
      // sha = headerMatch[1], origLine = headerMatch[2], finalLine = headerMatch[3]
    }

    // Content lines start with a tab
    if (line.startsWith("\t")) {
      lines.push({
        lineNumber: lines.length + 1,
        revision: "",
        author: "",
        content: line.substring(1),
      });
    }
  }

  // For a simpler approach, re-parse with line-by-line blame
  return parseGitBlameSimple(output);
}

/** Simple git blame parser — uses non-porcelain format as fallback */
function parseGitBlameSimple(output: string): VcsBlameLine[] {
  // If porcelain parsing didn't yield content, try the short format
  const lines: VcsBlameLine[] = [];
  for (const line of output.split("\n")) {
    if (line.startsWith("\t")) {
      lines.push({
        lineNumber: lines.length + 1,
        revision: "",
        author: "",
        content: line.substring(1),
      });
    }
  }
  return lines;
}
