"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { VcsLogEntry } from "@/core/vcs/vcs-unified-types";
import type { VcsLogAdapter, VcsLogQuery } from "./types";

interface SvnLogViewProps {
  adapter: VcsLogAdapter;
  repoPath: string;
  onSelectEntry?: (entry: VcsLogEntry) => void;
  selectedId?: string | null;
}

/**
 * SVN Log View — flat revision list with infinite scroll.
 */
export function SvnLogView({ adapter, repoPath, onSelectEntry, selectedId }: SvnLogViewProps) {
  const [entries, setEntries] = useState<VcsLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const LIMIT = 25;

  const loadMore = useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);

    try {
      const query: VcsLogQuery = {
        repoPath,
        limit: LIMIT,
        skip: reset ? 0 : skip,
        search: search || undefined,
      };

      const page = await adapter.getLog(query);

      if (reset) {
        setEntries(page.commits);
        setSkip(LIMIT);
      } else {
        setEntries((prev) => {
          // Deduplicate by id
          const existing = new Set(prev.map((e) => e.id));
          const fresh = page.commits.filter((c) => !existing.has(c.id));
          return [...prev, ...fresh];
        });
        setSkip((prev) => prev + LIMIT);
      }
      setHasMore(page.hasMore);
    } catch {
      // Silently handle — UI shows existing entries
    } finally {
      setLoading(false);
    }
  }, [adapter, repoPath, skip, search, loading]);

  // Initial load + search change
  useEffect(() => {
    setSkip(0);
    setHasMore(true);
    void loadMore(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, search]);

  // Scroll handler for infinite loading
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 100 && hasMore && !loading) {
        void loadMore();
      }
    },
    [hasMore, loading, loadMore],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="border-b border-desktop-border px-3 py-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={"搜索修订版..."}
          className="w-full rounded-md border border-desktop-border bg-desktop-surface px-3 py-1.5 text-sm text-desktop-text-primary placeholder:text-desktop-text-secondary focus:outline-none focus:ring-1 focus:ring-desktop-accent"
        />
      </div>

      {/* Revision list */}
      <div
        className="flex-1 overflow-y-auto desktop-scrollbar-thin"
        onScroll={handleScroll}
        data-testid="svn-log-list"
      >
        {entries.length === 0 && !loading && (
          <div className="flex items-center justify-center py-8 text-sm text-desktop-text-secondary">
            {"暂无提交历史"}
          </div>
        )}

        {entries.map((entry) => (
          <SvnLogRow
            key={entry.id}
            entry={entry}
            selected={entry.id === selectedId}
            onClick={() => onSelectEntry?.(entry)}
          />
        ))}

        {loading && (
          <div className="flex items-center justify-center py-3 text-sm text-desktop-text-secondary">
            <span className="animate-pulse">加载中...</span>
          </div>
        )}

        {!hasMore && entries.length > 0 && (
          <div className="py-3 text-center text-xs text-desktop-text-secondary">
            — {"已加载全部"} —
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Row Component ─────────────────────────────────────────────────

function SvnLogRow({
  entry,
  selected,
  onClick,
}: {
  entry: VcsLogEntry;
  selected: boolean;
  onClick: () => void;
}) {
  const dateStr = formatDate(entry.date);

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 border-b border-desktop-border px-3 py-2 text-left transition-colors hover:bg-desktop-surface-hover ${
        selected ? "bg-desktop-surface-active" : ""
      }`}
      data-testid={`svn-log-entry-${entry.id}`}
    >
      {/* Revision badge */}
      <span className="mt-0.5 shrink-0 rounded-md bg-desktop-surface-muted px-1.5 py-0.5 font-mono text-xs text-desktop-text-secondary">
        {entry.shortId}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-desktop-text-primary">
          {entry.summary}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-desktop-text-secondary">
          <span>{entry.author}</span>
          <span>·</span>
          <span>{dateStr}</span>
        </div>
      </div>
    </button>
  );
}

/** Format ISO date to a human-readable relative/absolute string */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = Date.now();
    const diff = now - date.getTime();

    // Less than 1 hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return mins <= 1 ? "刚刚" : `${mins}分钟前`;
    }
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}小时前`;
    }
    // Less than 30 days
    if (diff < 2592000000) {
      const days = Math.floor(diff / 86400000);
      return `${days}天前`;
    }
    // Absolute date
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  } catch {
    return isoDate;
  }
}
