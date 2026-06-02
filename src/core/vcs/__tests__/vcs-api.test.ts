/**
 * API route capability enforcement tests.
 * Tests that VCS-specific routes reject unsupported operations.
 */

import { describe, it, expect } from "vitest";
import { hasVcsCapability } from "../vcs-capabilities";
import type { VcsCapability } from "../vcs-types";

/**
 * Verify that the capability system correctly gates operations.
 * These are unit-level checks that mirror what the API routes enforce.
 */
describe("API capability enforcement", () => {
  const gitOnlyOperations: { capability: VcsCapability; label: string }[] = [
    { capability: "stageUnstage", label: "stage/unstage" },
    { capability: "rebase", label: "rebase" },
    { capability: "reset", label: "reset" },
    { capability: "worktree", label: "worktree" },
    { capability: "branchManagement", label: "branch management" },
    { capability: "logGraph", label: "git log graph" },
  ];

  it.each(gitOnlyOperations)(
    "rejects $label for SVN codebase",
    ({ capability }) => {
      expect(hasVcsCapability("svn", capability)).toBe(false);
    }
  );

  it.each(gitOnlyOperations)(
    "rejects $label for non-VCS codebase",
    ({ capability }) => {
      expect(hasVcsCapability("none", capability)).toBe(false);
    }
  );

  const sharedOperations: { capability: VcsCapability; label: string }[] = [
    { capability: "commit", label: "commit" },
    { capability: "diff", label: "diff" },
    { capability: "pullUpdate", label: "pull/update" },
    { capability: "blame", label: "blame" },
  ];

  it.each(sharedOperations)(
    "allows $label for both Git and SVN",
    ({ capability }) => {
      expect(hasVcsCapability("git", capability)).toBe(true);
      expect(hasVcsCapability("svn", capability)).toBe(true);
    }
  );

  it("allows only fileBrowse and fileEdit for non-VCS", () => {
    const caps = ["fileBrowse", "fileEdit"] as VcsCapability[];
    caps.forEach((cap) => {
      expect(hasVcsCapability("none", cap)).toBe(true);
    });

    // All other capabilities should be false
    const allCaps: VcsCapability[] = [
      "fileBrowse", "fileEdit", "diff", "commitHistory", "stageUnstage",
      "commit", "branchManagement", "pullUpdate", "push", "rebase",
      "reset", "worktree", "blame", "logGraph", "remoteAuth",
    ];
    const disallowed = allCaps.filter((c) => !caps.includes(c));
    disallowed.forEach((cap) => {
      expect(hasVcsCapability("none", cap)).toBe(false);
    });
  });
});
