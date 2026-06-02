"use client";

import React from "react";
import { Search, RefreshCw, Filter, X } from "lucide-react";

interface GitLogToolbarProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  activeBranches: string[];
  onClearFilters: () => void;
  onRefresh: () => void;
  total: number;
  loading: boolean;
}

export function GitLogToolbar({
  searchText,
  onSearchChange,
  activeBranches,
  onClearFilters,
  onRefresh,
  total,
  loading,
}: GitLogToolbarProps) {
  return (
    <div className="flex items-center gap-1.5 border-b border-desktop-border bg-desktop-bg-secondary/80 px-2 py-1">
      {/* Search */}
      <div className="relative flex min-w-0 flex-1 items-center">
        <Search className="pointer-events-none absolute left-1.5 h-3 w-3 text-desktop-text-tertiary" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter by message, hash, author…"
          className="h-6 w-full rounded border border-desktop-border bg-desktop-bg-primary pl-6 pr-2 text-[11px] text-desktop-text-primary placeholder:text-desktop-text-tertiary outline-none transition-colors focus:border-desktop-accent"
        />
        {searchText && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-1 rounded p-0.5 text-desktop-text-tertiary hover:text-desktop-text-primary"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Active branch filter indicator */}
      {activeBranches.length > 0 && (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex h-6 items-center gap-1 rounded border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] px-1.5 text-[10px] font-medium text-[var(--dt-status-warning)] transition-colors hover:brightness-95"
          title="Clear branch filters"
        >
          <Filter className="h-2.5 w-2.5" />
          <span>{activeBranches.length}</span>
          <X className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Commit count */}
      <span className="shrink-0 text-[10px] tabular-nums text-desktop-text-tertiary">
        {total} commits
      </span>

      {/* Refresh */}
      <button
        type="button"
        onClick={onRefresh}
        className="rounded p-1 text-desktop-text-tertiary transition-colors hover:bg-desktop-bg-active hover:text-desktop-text-primary"
        title="Refresh"
        disabled={loading}
      >
        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
