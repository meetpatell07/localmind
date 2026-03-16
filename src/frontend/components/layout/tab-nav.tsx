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
    <nav className="flex flex-col gap-1 p-2">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
