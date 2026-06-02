/**
 * Tests for VCS detection and capabilities.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the platform bridge before importing the modules under test
vi.mock("../../platform", () => ({
  getServerBridge: () => ({
    fs: {
      existsSync: vi.fn((p: string) => mockedPaths.has(p)),
    },
    env: {
      homeDir: () => "/home/test",
      currentDir: () => "/cwd",
    },
  }),
}));

let mockedPaths: Set<string> = new Set();

import { detectVcsType, resolveVcsType } from "../vcs-detect";
import { getVcsCapabilities, hasVcsCapability } from "../vcs-capabilities";
import type { VcsType, VcsCapability } from "../vcs-types";

// ─── detectVcsType ─────────────────────────────────────────────────

describe("detectVcsType", () => {
  beforeEach(() => {
    mockedPaths = new Set();
  });

  it("detects Git repository (.git/ exists)", () => {
    mockedPaths.add("/project/.git");
    mockedPaths.add("/project"); // dir itself exists
    expect(detectVcsType("/project")).toBe("git");
  });

  it("detects SVN working copy (.svn/ exists)", () => {
    mockedPaths.add("/project/.svn");
    mockedPaths.add("/project");
    expect(detectVcsType("/project")).toBe("svn");
  });

  it("detects SVN subdirectory (SVN 1.7+: .svn only at ancestor)", () => {
    // SVN root at /svnroot, subdirectory /svnroot/client/GameProject
    mockedPaths.add("/svnroot/.svn");
    mockedPaths.add("/svnroot");
    mockedPaths.add("/svnroot/client");
    mockedPaths.add("/svnroot/client/GameProject");
    expect(detectVcsType("/svnroot/client/GameProject")).toBe("svn");
  });

  it("detects plain directory (no VCS metadata)", () => {
    mockedPaths.add("/project");
    expect(detectVcsType("/project")).toBe("none");
  });

  it("Git takes priority over SVN when both exist", () => {
    mockedPaths.add("/project/.git");
    mockedPaths.add("/project/.svn");
    mockedPaths.add("/project");
    expect(detectVcsType("/project")).toBe("git");
  });

  it("returns undefined for nonexistent path", () => {
    // mockedPaths is empty, so nothing exists
    expect(detectVcsType("/nonexistent")).toBeUndefined();
  });
});

// ─── resolveVcsType ────────────────────────────────────────────────

describe("resolveVcsType", () => {
  it("returns 'git' for 'git'", () => {
    expect(resolveVcsType("git")).toBe("git");
  });

  it("returns 'svn' for 'svn'", () => {
    expect(resolveVcsType("svn")).toBe("svn");
  });

  it("returns 'none' for 'none'", () => {
    expect(resolveVcsType("none")).toBe("none");
  });

  it("defaults to 'git' for undefined", () => {
    expect(resolveVcsType(undefined)).toBe("git");
  });

  it("defaults to 'git' for null", () => {
    expect(resolveVcsType(null)).toBe("git");
  });

  it("defaults to 'git' for unknown strings", () => {
    expect(resolveVcsType("mercurial")).toBe("git");
  });
});

// ─── getVcsCapabilities ───────────────────────────────────────────

describe("getVcsCapabilities", () => {
  it("returns all 15 capabilities for Git", () => {
    const caps = getVcsCapabilities("git");
    expect(caps.size).toBe(15);
    expect(caps.has("fileBrowse")).toBe(true);
    expect(caps.has("stageUnstage")).toBe(true);
    expect(caps.has("branchManagement")).toBe(true);
    expect(caps.has("worktree")).toBe(true);
    expect(caps.has("logGraph")).toBe(true);
  });

  it("returns 9 capabilities for SVN", () => {
    const caps = getVcsCapabilities("svn");
    expect(caps.size).toBe(9);
    expect(caps.has("fileBrowse")).toBe(true);
    expect(caps.has("commit")).toBe(true);
    expect(caps.has("diff")).toBe(true);
    expect(caps.has("pullUpdate")).toBe(true);
    expect(caps.has("blame")).toBe(true);
    // SVN does NOT have:
    expect(caps.has("stageUnstage")).toBe(false);
    expect(caps.has("branchManagement")).toBe(false);
    expect(caps.has("rebase")).toBe(false);
    expect(caps.has("reset")).toBe(false);
    expect(caps.has("worktree")).toBe(false);
    expect(caps.has("logGraph")).toBe(false);
  });

  it("returns 2 capabilities for non-VCS", () => {
    const caps = getVcsCapabilities("none");
    expect(caps.size).toBe(2);
    expect(caps.has("fileBrowse")).toBe(true);
    expect(caps.has("fileEdit")).toBe(true);
    expect(caps.has("commit")).toBe(false);
    expect(caps.has("diff")).toBe(false);
  });

  it("defaults to Git capabilities for undefined", () => {
    const caps = getVcsCapabilities(undefined);
    expect(caps.size).toBe(15);
  });

  it("defaults to Git capabilities for null", () => {
    const caps = getVcsCapabilities(null);
    expect(caps.size).toBe(15);
  });
});

// ─── hasVcsCapability ─────────────────────────────────────────────

describe("hasVcsCapability", () => {
  it("returns true for Git + commit", () => {
    expect(hasVcsCapability("git", "commit")).toBe(true);
  });

  it("returns false for SVN + stageUnstage", () => {
    expect(hasVcsCapability("svn", "stageUnstage")).toBe(false);
  });

  it("returns false for none + commit", () => {
    expect(hasVcsCapability("none", "commit")).toBe(false);
  });

  it("returns true for undefined (defaults to Git)", () => {
    expect(hasVcsCapability(undefined, "worktree")).toBe(true);
  });
});
