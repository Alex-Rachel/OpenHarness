/**
 * SVN Exec — safe CLI wrapper for SVN commands.
 *
 * Mirrors the gitExec() pattern from safe-exec.ts but for the `svn` binary.
 * On Windows with CJK locale, SVN outputs in the system codepage (e.g. GBK/CP936).
 * We read raw bytes and try UTF-8 first, falling back to GBK for proper decoding.
 */

import { execFileSync } from "child_process";

/**
 * Decode SVN CLI output, handling Windows CJK codepages.
 *
 * Strategy:
 * 1. Try strict UTF-8 decode — works on Unix and Windows UTF-8 locales.
 * 2. If that fails (invalid byte sequences), fall back to GBK (Chinese Windows).
 * 3. If GBK is also unavailable, return best-effort UTF-8.
 */
function decodeSvnOutput(buffer: Buffer): string {
  // Try strict UTF-8 first
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return decoder.decode(new Uint8Array(buffer));
  } catch {
    // Not valid UTF-8 — likely a CJK codepage on Windows
  }

  // Try GBK (Chinese Windows codepage 936)
  try {
    const decoder = new TextDecoder("gbk");
    return decoder.decode(new Uint8Array(buffer));
  } catch {
    // GBK not supported (unlikely — full ICU is bundled)
  }

  // Last resort: best-effort UTF-8
  return buffer.toString("utf-8");
}

/**
 * Execute an SVN CLI command synchronously.
 * Reads raw output and decodes with proper encoding handling.
 */
export function svnExec(args: string[], options?: { cwd?: string }): string {
  const buffer = execFileSync("svn", args, {
    cwd: options?.cwd,
    encoding: "buffer",
    windowsHide: true,
  }) as Buffer;

  return decodeSvnOutput(buffer);
}

/**
 * Execute an SVN command that may produce large output (like diff/log).
 * Accepts an optional maxBuffer in bytes (default 10 MB).
 */
export function svnExecBuffered(
  args: string[],
  options?: { cwd?: string; maxBuffer?: number },
): string {
  const buffer = execFileSync("svn", args, {
    cwd: options?.cwd,
    maxBuffer: options?.maxBuffer ?? 10 * 1024 * 1024, // 10 MB default
    encoding: "buffer",
    windowsHide: true,
  }) as Buffer;

  return decodeSvnOutput(buffer);
}
