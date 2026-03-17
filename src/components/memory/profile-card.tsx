"use client";

import { useState } from "react";
import { UserIcon, RefreshIcon, ArrowDown01Icon, ArrowUp01Icon } from "hugeicons-react";

interface ProfileCardProps {
  profile: string | null;
  onRebuild: () => Promise<void>;
  rebuilding: boolean;
}

export function ProfileCard({ profile, onRebuild, rebuilding }: ProfileCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{ border: "1px solid var(--line)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{ background: "var(--surface-raised)", borderBottom: "1px solid var(--line)" }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2.5">
          <UserIcon className="h-3.5 w-3.5" style={{ color: "var(--amber)" }} />
          <span className="text-sm tracking-widest uppercase opacity-60">
            Profile
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onRebuild(); }}
            disabled={rebuilding}
            className="flex items-center gap-1.5 text-sm opacity-40 hover:opacity-80 transition-opacity disabled:opacity-20"
          >
            <RefreshIcon className={`h-3 w-3 ${rebuilding ? "animate-spin" : ""}`} />
            {rebuilding ? "rebuilding..." : "rebuild"}
          </button>
          {expanded
            ? <ArrowUp01Icon className="h-3.5 w-3.5 opacity-30" />
            : <ArrowDown01Icon className="h-3.5 w-3.5 opacity-30" />
          }
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 py-4" style={{ background: "var(--navy)" }}>
          {profile ? (
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: "hsl(210 18% 70%)" }}
            >
              {profile}
            </p>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm opacity-25">
                No profile yet — start chatting to build one.
              </p>
              <p className="text-sm opacity-15 mt-1">
                Profile auto-builds after every 50 interactions.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
