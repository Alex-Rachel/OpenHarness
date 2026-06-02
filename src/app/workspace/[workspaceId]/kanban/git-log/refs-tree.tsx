"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Tag,
  Globe,
  MapPin,
} from "lucide-react";
import type { GitRefsResult, GitRef } from "./types";

interface RefsTreeProps {
  refs: GitRefsResult | null;
  activeBranches: string[];
  onToggleBranch: (name: string) => void;
}

interface TreeNodeProps {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}

function gitRefKey(gitRef: GitRef): string {
  return gitRef.remote ? `${gitRef.remote}/${gitRef.name}` : gitRef.name;
}

function TreeNode({ label, icon, children, defaultOpen = true, count }: TreeNodeProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-desktop-text-secondary hover:bg-desktop-bg-active"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {count != null && (
          <span className="text-[10px] font-normal tabular-nums text-desktop-text-tertiary">
            {count}
          </span>
        )}
      </button>
      {open && <div className="ml-2">{children}</div>}
    </div>
  );
}

function RefItem({
  gitRef,
  active,
  onClick,
}: {
  gitRef: GitRef;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-0.75 text-left text-[11px] transition-colors ${
        active
          ? "bg-desktop-bg-active font-medium text-desktop-text-primary"
          : "text-desktop-text-secondary hover:bg-desktop-bg-active"
      }`}
      title={gitRef.remote ? `${gitRef.remote}/${gitRef.name}` : gitRef.name}
    >
      {gitRef.isCurrent && (
        <MapPin className="h-2.5 w-2.5 shrink-0 text-[var(--dt-status-success)]" />
      )}
      <span className="truncate">
        {gitRefKey(gitRef)}
      </span>
    </button>
  );
}

export function RefsTree({ refs, activeBranches, onToggleBranch }: RefsTreeProps) {
  if (!refs) {
    return (
      <div className="px-2 py-4 text-center text-[11px] text-desktop-text-tertiary">
        Loading…
      </div>
    );
  }
  const headRef = refs.head;

  // Group remote branches by remote name
  const remoteGroups = new Map<string, GitRef[]>();
  for (const r of refs.remote) {
    const remote = r.remote ?? "origin";
    const list = remoteGroups.get(remote) ?? [];
    list.push(r);
    remoteGroups.set(remote, list);
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto py-1 text-[11px]">
      {/* HEAD */}
      {headRef && (
        <TreeNode
          label="HEAD"
          icon={<MapPin className="h-3 w-3 shrink-0 text-[var(--dt-status-success)]" />}
          defaultOpen
        >
          <RefItem
            gitRef={headRef}
            active={activeBranches.includes(gitRefKey(headRef))}
            onClick={() => onToggleBranch(gitRefKey(headRef))}
          />
        </TreeNode>
      )}

      {/* Local branches */}
      <TreeNode
        label="Local"
        icon={<GitBranch className="h-3 w-3 shrink-0 text-[var(--dt-status-info)]" />}
        count={refs.local.length}
        defaultOpen
      >
        {refs.local.map((r) => (
          <RefItem
            key={r.name}
            gitRef={r}
            active={activeBranches.includes(gitRefKey(r))}
            onClick={() => onToggleBranch(gitRefKey(r))}
          />
        ))}
      </TreeNode>

      {/* Remote branches grouped by remote */}
      <TreeNode
        label="Remote"
        icon={<Globe className="h-3 w-3 shrink-0 text-[var(--dt-status-info)]" />}
        count={refs.remote.length}
        defaultOpen={false}
      >
        {Array.from(remoteGroups.entries()).map(([remote, branches]) => (
          <TreeNode
            key={remote}
            label={remote}
            icon={<Globe className="h-2.5 w-2.5 shrink-0 text-[var(--dt-status-info)]" />}
            count={branches.length}
          >
            {branches.map((r) => (
              <RefItem
                key={`${r.remote}/${r.name}`}
                gitRef={r}
                active={activeBranches.includes(gitRefKey(r))}
                onClick={() => onToggleBranch(gitRefKey(r))}
              />
            ))}
          </TreeNode>
        ))}
      </TreeNode>

      {/* Tags */}
      {refs.tags.length > 0 && (
        <TreeNode
          label="Tags"
          icon={<Tag className="h-3 w-3 shrink-0 text-[var(--dt-status-warning)]" />}
          count={refs.tags.length}
          defaultOpen={false}
        >
          {refs.tags.map((r) => (
            <RefItem
              key={r.name}
              gitRef={r}
              active={activeBranches.includes(gitRefKey(r))}
              onClick={() => onToggleBranch(gitRefKey(r))}
            />
          ))}
        </TreeNode>
      )}
    </div>
  );
}
