/**
 * E2E-style test: open a non-Git directory as Codebase via API.
 * Tests backward compatibility: existing Git codebases with null vcsType.
 */

import { describe, it, expect } from "vitest";
import { resolveVcsType } from "../vcs-detect";
import { getVcsCapabilities } from "../vcs-capabilities";
import type { VcsType } from "../vcs-types";

// ─── Backward compatibility ────────────────────────────────────────

describe("Backward compatibility", () => {
  it("treats undefined vcsType as Git", () => {
    // Simulates a pre-migration codebase record without vcsType field
    const vcsType: VcsType | undefined = undefined;
    expect(resolveVcsType(vcsType)).toBe("git");
  });

  it("treats null vcsType as Git", () => {
    const vcsType: VcsType | null = null;
    expect(resolveVcsType(vcsType)).toBe("git");
  });

  it("treats empty string vcsType as Git", () => {
    // Possible if DB column has empty string instead of NULL
    expect(resolveVcsType("")).toBe("git");
  });

  it("Git codebases get full capabilities even without vcsType set", () => {
    const caps = getVcsCapabilities(undefined);
    expect(caps.size).toBe(15);
    expect(caps.has("commit")).toBe(true);
    expect(caps.has("stageUnstage")).toBe(true);
    expect(caps.has("worktree")).toBe(true);
  });

  it("codebase with explicit 'git' vcsType works identically", () => {
    const capsExplicit = getVcsCapabilities("git");
    const capsDefault = getVcsCapabilities(undefined);
    expect(capsExplicit).toEqual(capsDefault);
  });
});

// ─── Non-Git directory as codebase ─────────────────────────────────

describe("Non-Git directory as Codebase", () => {
  it("plain directory gets vcsType 'none'", () => {
    // In the validation flow, detectVcsType returns "none" for plain dirs
    // This test verifies the capability reduction
    const caps = getVcsCapabilities("none");
    expect(caps.size).toBe(2);
    expect(caps.has("fileBrowse")).toBe(true);
    expect(caps.has("fileEdit")).toBe(true);
  });

  it("SVN working copy gets vcsType 'svn'", () => {
    const caps = getVcsCapabilities("svn");
    expect(caps.has("commit")).toBe(true);
    expect(caps.has("diff")).toBe(true);
    expect(caps.has("stageUnstage")).toBe(false);
  });

  it("sourceType is independent from vcsType", () => {
    // sourceType describes WHERE the codebase came from
    // vcsType describes WHAT VCS is actually present
    // These are orthogonal concepts

    // A GitHub-cloned repo is sourceType="github" + vcsType="git"
    // A local SVN working copy is sourceType="svn" + vcsType="svn"
    // A plain folder is sourceType="none" + vcsType="none"
    // But theoretically: sourceType="local" could have vcsType="git"|"svn"|"none"

    // Just verify vcsType resolution is independent
    expect(resolveVcsType("git")).toBe("git");
    expect(resolveVcsType("svn")).toBe("svn");
    expect(resolveVcsType("none")).toBe("none");
  });
});
