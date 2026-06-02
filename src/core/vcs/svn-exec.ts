/**
 * SVN Exec — safe CLI wrapper for SVN commands.
 *
 * Mirrors the gitExec() pattern from safe-exec.ts but for the `svn` binary.
 */

import { safeExecSync } from "../utils/safe-exec";

/**
 * Execute an SVN CLI command synchronously.
 * Uses execFileSync with argv separation to prevent shell injection.
 */
export function svnExec(args: string[], options?: { cwd?: string }): string {
  return safeExecSync("svn", args, options);
}

/**
 * Execute an SVN command that may produce large output (like diff/log).
 * Accepts an optional timeout in milliseconds.
 */
export function svnExecBuffered(
  args: string[],
  options?: { cwd?: string; maxBuffer?: number },
): string {
  const { execFileSync } = require("child_process") as typeof import("child_process");
  return execFileSync("svn", args, {
    cwd: options?.cwd,
    maxBuffer: options?.maxBuffer ?? 10 * 1024 * 1024, // 10 MB default
    encoding: "utf-8",
    windowsHide: true,
  });
}
