"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserIcon, RefreshIcon, ArrowDown01Icon, ArrowUp01Icon } from "hugeicons-react";

interface ProfileCardProps {
  profile: string | null;
  onRebuild: () => Promise<void>;
  rebuilding: boolean;
}

export function ProfileCard({ profile, onRebuild, rebuilding }: ProfileCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2.5">
          <UserIcon className="size-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Profile
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="xs"
            onClick={(e) => { e.stopPropagation(); onRebuild(); }}
            disabled={rebuilding}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors disabled:text-gray-300"
          >
            <RefreshIcon className={`size-3 ${rebuilding ? "animate-spin" : ""}`} />
            {rebuilding ? "Rebuilding..." : "Rebuild"}
          </Button>
          {expanded
            ? <ArrowUp01Icon className="size-3.5 text-gray-300" />
            : <ArrowDown01Icon className="size-3.5 text-gray-300" />
          }
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 py-4">
          {profile ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
              {profile}
            </p>
          ) : (
            <div className="py-8 text-center">
              <UserIcon className="size-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                No profile yet — start chatting to build one.
              </p>
              <p className="text-xs text-gray-300 mt-1">
                Profile auto-builds after every 50 interactions.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
