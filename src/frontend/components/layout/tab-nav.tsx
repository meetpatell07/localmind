"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/frontend/lib/utils";
import {
  MessageSquare,
  Brain,
  CheckSquare,
  FolderOpen,
  Mic,
} from "lucide-react";

const tabs = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/planner", label: "Tasks", icon: CheckSquare },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/voice", label: "Voice", icon: Mic },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="Main navigation">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
            )}
          >
            {/* Active glow indicator */}
            {active && (
              <div
                className="absolute inset-0 rounded-xl bg-primary/5 ring-1 ring-primary/20"
                aria-hidden="true"
              />
            )}

            <Icon
              className={cn(
                "h-4 w-4 shrink-0 relative z-10 transition-transform duration-200",
                active
                  ? "text-primary"
                  : "group-hover:scale-110"
              )}
              aria-hidden="true"
            />
            <span className="relative z-10">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
