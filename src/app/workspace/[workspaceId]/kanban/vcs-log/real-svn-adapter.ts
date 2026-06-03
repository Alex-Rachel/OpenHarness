/**
 * SVN Log Adapter — reuses the existing /git/* routes which already have
 * SVN dispatch in the Rust backend.
 *
 * The Rust backend proxies ALL /api/* requests and handles CORS.
 * - /git/commits       → SVN log via get_svn_log()
 * - /git/commits/:id/diff → SVN revision diff via get_svn_revision_diff()
 *
 * IMPORTANT: Do NOT use /vcs/* routes here — they bypass the Rust proxy
 * and hit Next.js directly, which lacks CORS headers for cross-origin
 * requests (frontend runs on a different port).
 */

import { desktopAwareFetch } from "@/client/utils/diagnostics";
import type { VcsLogAdapter, VcsLogQuery, VcsLogPage } from "./types";
import type { VcsCommitDetail, VcsFileChange } from "@/core/vcs/vcs-unified-types";

interface SvnAdapterOptions {
  workspaceId: string;
  codebaseId: string;
}

export class RealSvnLogAdapter implements VcsLogAdapter {
  private opts: SvnAdapterOptions;

  constructor(opts: SvnAdapterOptions) {
    this.opts = opts;
  }

  private get basePath(): string {
    return `/api/workspaces/${encodeURIComponent(this.opts.workspaceId)}/codebases/${encodeURIComponent(this.opts.codebaseId)}/git`;
  }

  async getLog(query: VcsLogQuery): Promise<VcsLogPage> {
    const params = new URLSearchParams({
      limit: String(query.limit ?? 25),
      since: query.search || "",
    });

    const res = await desktopAwareFetch(`${this.basePath}/commits?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Failed to fetch SVN log: ${res.status}`);
    }
    const data = await res.json();

    // The /git/commits route returns { commits: [...] } for both Git and SVN
    // SVN entries have sha as "r<N>", Git entries have actual SHAs
    const commits = (data.commits || []).map((c: Record<string, unknown>) => ({
      id: (c.sha || c.id || "") as string,
      shortId: (c.sha || c.id || "").toString().substring(0, 7) as string,
      author: (c.authorName || c.author || "") as string,
      authorEmail: (c.authorEmail || undefined) as string | undefined,
      date: (c.authoredAt || c.date || "") as string,
      message: (c.message || "") as string,
      summary: ((c.summary || c.message || "") as string).split("\n")[0].substring(0, 80),
    }));

    return {
      commits,
      total: data.count || commits.length,
      hasMore: data.count ? commits.length >= (query.limit ?? 25) : false,
    };
  }

  async getCommitDetail(_repoPath: string, id: string): Promise<VcsCommitDetail> {
    // Use /git/commits/:id/diff — the Rust backend dispatches SVN via
    // get_svn_revision_diff() when the codebase vcsType is "svn"
    const res = await desktopAwareFetch(
      `${this.basePath}/commits/${encodeURIComponent(id)}/diff`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Failed to fetch revision detail: ${res.status}`);
    }
    const data = await res.json();

    const patch: string | undefined = data.diff || data.patch || undefined;

    // Parse file changes from the SVN diff output
    const files = patch ? parseFilesFromSvnDiff(patch) : [];

    return {
      id: id,
      shortId: id.substring(0, 7),
      author: data.author || "",
      date: data.date || "",
      message: data.message || "",
      files,
      patch,
    };
  }
}

/**
 * Parse file changes from SVN unified diff output.
 *
 * SVN diff format:
 *   Index: path/to/file
 *   ===================================================================
 *   --- path/to/file   (revision 135658)
 *   +++ path/to/file   (working copy)
 *   @@ -1,5 +1,5 @@
 *   ...
 *
 * For added files:
 *   Index: path/to/newfile
 *   ===================================================================
 *   --- path/to/newfile   (revision 0)
 *   +++ path/to/newfile   (revision 135659)
 *
 * For deleted files:
 *   Index: path/to/deleted
 *   ===================================================================
 *   --- path/to/deleted   (revision 135658)
 *   +++ path/to/deleted   (working copy)
 *   @@ -1,10 +0,0 @@
 */
function parseFilesFromSvnDiff(patch: string): VcsFileChange[] {
  const files: VcsFileChange[] = [];
  const lines = patch.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // SVN diff header: "Index: path"
    if (line.startsWith("Index: ")) {
      const path = line.substring(7).trim();
      if (!path) continue;

      let status: VcsFileChange["status"] = "modified";

      // Look ahead to determine status from the --- / +++ lines
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const lookLine = lines[j];
        // "(revision 0)" on the --- line means the file was added
        if (lookLine.startsWith("--- ") && lookLine.includes("(revision 0)")) {
          status = "added";
          break;
        }
        // "+0,0" or "+0" in the hunk header means the file was deleted
        if (lookLine.startsWith("@@ ") && lookLine.includes("+0")) {
          // Check if there's content after this — deleted files show "-N,M +0,0"
          const plusPart = lookLine.match(/\+0(?:,\d+)?\s*@@/);
          if (plusPart) {
            status = "deleted";
            break;
          }
        }
      }

      files.push({ path, status });
    }
  }

  return files;
}
