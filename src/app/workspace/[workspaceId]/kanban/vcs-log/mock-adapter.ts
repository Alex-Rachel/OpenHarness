/**
 * Mock VCS Log Adapter — provides fake data for UI development.
 */

import type { VcsLogAdapter, VcsLogQuery, VcsLogPage } from "./types";
import type { VcsLogEntry, VcsCommitDetail } from "@/core/vcs/vcs-unified-types";

function rev(n: number): string {
  return `r${n}`;
}

const MOCK_SVN_COMMITS: VcsLogEntry[] = Array.from({ length: 50 }, (_, i) => {
  const r = 50 - i;
  return {
    id: rev(r),
    shortId: rev(r),
    author: ["张三", "李四", "王五", "赵六"][i % 4],
    date: new Date(Date.now() - i * 3600000 * 6).toISOString(),
    message: [
      "修复用户登录页面样式问题",
      "添加SVN日志查询功能",
      "重构VCS统一路由层",
      "更新依赖版本",
      "修复分页查询的边界条件",
    ][i % 5],
    summary: [
      "修复用户登录页面样式问题",
      "添加SVN日志查询功能",
      "重构VCS统一路由层",
      "更新依赖版本",
      "修复分页查询的边界条件",
    ][i % 5],
    parents: r > 1 ? [rev(r - 1)] : [],
  };
});

export class MockSvnLogAdapter implements VcsLogAdapter {
  async getLog(query: VcsLogQuery): Promise<VcsLogPage> {
    const limit = query.limit ?? 25;
    const skip = query.skip ?? 0;

    let filtered = [...MOCK_SVN_COMMITS];
    if (query.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.message.toLowerCase().includes(s) ||
          c.author.toLowerCase().includes(s) ||
          c.id.includes(s),
      );
    }

    const page = filtered.slice(skip, skip + limit);
    return {
      commits: page,
      total: filtered.length,
      hasMore: skip + limit < filtered.length,
    };
  }

  async getCommitDetail(_repoPath: string, id: string): Promise<VcsCommitDetail> {
    const entry = MOCK_SVN_COMMITS.find((c) => c.id === id);
    if (!entry) {
      throw new Error(`Revision ${id} not found`);
    }

    return {
      id: entry.id,
      shortId: entry.shortId,
      author: entry.author,
      date: entry.date,
      message: entry.message,
      files: [
        {
          path: `src/core/vcs/svn-utils.ts`,
          status: "modified",
        },
        {
          path: `src/app/api/vcs/log/route.ts`,
          status: "added",
        },
        {
          path: `src/app/workspace/kanban/vcs-log/svn-log-view.tsx`,
          status: "added",
        },
      ],
      patch: `Index: src/core/vcs/svn-utils.ts\n--- a/src/core/vcs/svn-utils.ts\n+++ b/src/core/vcs/svn-utils.ts\n@@ -1,5 +1,8 @@\n // SVN Utilities\n+// Updated with new functions\n`,
    };
  }
}

// Also export a mock that wraps the existing Git mock for testing
export { MOCK_SVN_COMMITS };
