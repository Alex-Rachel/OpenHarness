/**
 * Tests for SVN adapter functions.
 * Uses mocked CLI output to verify parsing logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock svn-exec to control CLI output
vi.mock("../svn-exec", () => ({
  svnExec: vi.fn(),
}));

import { svnExec } from "../svn-exec";
import {
  getSvnStatus,
  getSvnDiff,
  svnCommit,
  svnUpdate,
  getSvnLog,
  svnBlame,
  svnRevert,
  svnAdd,
  parseSvnStatus,
  parseSvnLog,
  parseSvnBlame,
} from "../svn-utils";

const mockSvnExec = svnExec as unknown as ReturnType<typeof vi.fn>;

// ─── parseSvnStatus ────────────────────────────────────────────────

describe("parseSvnStatus", () => {
  it("parses modified files", () => {
    const input = "M       src/foo.ts\nM       src/bar.ts\n";
    const entries = parseSvnStatus(input);
    expect(entries).toHaveLength(2);
    expect(entries[0].statusCode).toBe("M");
    expect(entries[0].path).toBe("src/foo.ts");
    expect(entries[1].statusCode).toBe("M");
    expect(entries[1].path).toBe("src/bar.ts");
  });

  it("parses untracked files", () => {
    const input = "?       newfile.ts\n";
    const entries = parseSvnStatus(input);
    expect(entries).toHaveLength(1);
    expect(entries[0].statusCode).toBe("?");
    expect(entries[0].path).toBe("newfile.ts");
  });

  it("parses added files", () => {
    const input = "A       added.ts\n";
    const entries = parseSvnStatus(input);
    expect(entries[0].statusCode).toBe("A");
  });

  it("returns empty array for empty input", () => {
    expect(parseSvnStatus("")).toEqual([]);
    expect(parseSvnStatus("  ")).toEqual([]);
  });

  it("handles mixed statuses", () => {
    const input = "M       modified.ts\n?       untracked.ts\nA       added.ts\nD       deleted.ts\n";
    const entries = parseSvnStatus(input);
    expect(entries).toHaveLength(4);
    const status = getSvnStatus("/repo");
    // Note: getSvnStatus calls svnExec which is mocked
  });
});

// ─── getSvnStatus ──────────────────────────────────────────────────

describe("getSvnStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("categorizes entries by status", () => {
    mockSvnExec.mockReturnValue(
      "M       mod.ts\nA       add.ts\n?       new.ts\nD       del.ts\nC       conf.ts\n!       miss.ts\n"
    );
    const status = getSvnStatus("/repo");
    expect(status.modified).toHaveLength(1);
    expect(status.added).toHaveLength(1);
    expect(status.untracked).toHaveLength(1);
    expect(status.deleted).toHaveLength(1);
    expect(status.conflicted).toHaveLength(1);
    expect(status.missing).toHaveLength(1);
    expect(status.all).toHaveLength(6);
  });
});

// ─── parseSvnLog ───────────────────────────────────────────────────

describe("parseSvnLog", () => {
  it("parses log entries", () => {
    const input = `------------------------------------------------------------------------
r42 | john | 2024-01-15 10:30:00 +0000 (Mon, 15 Jan 2024) | 1 line

Fix the bug
------------------------------------------------------------------------
r41 | jane | 2024-01-14 09:00:00 +0000 (Sun, 14 Jan 2024) | 2 lines

Add new feature

With details
------------------------------------------------------------------------`;
    const entries = parseSvnLog(input);
    expect(entries).toHaveLength(2);
    expect(entries[0].revision).toBe(42);
    expect(entries[0].author).toBe("john");
    expect(entries[0].message).toBe("Fix the bug");
    expect(entries[1].revision).toBe(41);
    expect(entries[1].author).toBe("jane");
    expect(entries[1].message).toContain("Add new feature");
    expect(entries[1].message).toContain("With details");
  });

  it("returns empty for empty input", () => {
    expect(parseSvnLog("")).toEqual([]);
  });
});

// ─── parseSvnBlame ─────────────────────────────────────────────────

describe("parseSvnBlame", () => {
  it("parses blame output", () => {
    const input = `   42 john const foo = "bar";
   41 jane const baz = 123;
    -  -    // comment`;
    const lines = parseSvnBlame(input);
    expect(lines).toHaveLength(3);
    expect(lines[0].revision).toBe(42);
    expect(lines[0].author).toBe("john");
    expect(lines[0].content).toBe('const foo = "bar";');
    expect(lines[1].revision).toBe(41);
    expect(lines[2].revision).toBe(0); // "-" becomes 0
  });

  it("returns empty for empty input", () => {
    expect(parseSvnBlame("")).toEqual([]);
  });
});

// ─── svnCommit ─────────────────────────────────────────────────────

describe("svnCommit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws if no files specified", () => {
    expect(() => svnCommit("/repo", [], "msg")).toThrow(
      "At least one file must be specified"
    );
  });

  it("returns revision on success", () => {
    mockSvnExec.mockReturnValue("Committed revision 42.\n");
    const rev = svnCommit("/repo", ["file.ts"], "fix bug");
    expect(rev).toBe(42);
    expect(mockSvnExec).toHaveBeenCalledWith(
      ["commit", "file.ts", "-m", "fix bug"],
      { cwd: "/repo" }
    );
  });
});

// ─── svnUpdate ─────────────────────────────────────────────────────

describe("svnUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses updated revision", () => {
    mockSvnExec.mockReturnValue("Updating '.':\nUpdated to revision 42.\n");
    const result = svnUpdate("/repo");
    expect(result.revision).toBe(42);
  });

  it("parses 'at revision'", () => {
    mockSvnExec.mockReturnValue("At revision 42.\n");
    const result = svnUpdate("/repo");
    expect(result.revision).toBe(42);
  });
});

// ─── svnRevert ─────────────────────────────────────────────────────

describe("svnRevert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls svn revert with specific files", () => {
    mockSvnExec.mockReturnValue("");
    svnRevert("/repo", ["file1.ts", "file2.ts"]);
    expect(mockSvnExec).toHaveBeenCalledWith(
      ["revert", "file1.ts", "file2.ts"],
      { cwd: "/repo" }
    );
  });

  it("calls svn revert --recursive . for empty file list", () => {
    mockSvnExec.mockReturnValue("");
    svnRevert("/repo", []);
    expect(mockSvnExec).toHaveBeenCalledWith(
      ["revert", "--recursive", "."],
      { cwd: "/repo" }
    );
  });
});

// ─── svnAdd ────────────────────────────────────────────────────────

describe("svnAdd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls svn add with file path", () => {
    mockSvnExec.mockReturnValue("");
    svnAdd("/repo", "newfile.ts");
    expect(mockSvnExec).toHaveBeenCalledWith(
      ["add", "newfile.ts"],
      { cwd: "/repo" }
    );
  });
});
