"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Brain,
  CheckSquare,
  FolderOpen,
  Mic,
  Mail,
  Settings,
} from "lucide-react";

const mainTabs = [
  { href: "/chat",    label: "Chat",    icon: MessageSquare, num: "01" },
  { href: "/memory",  label: "Memory",  icon: Brain,         num: "02" },
  { href: "/planner", label: "Planner", icon: CheckSquare,   num: "03" },
  { href: "/files",   label: "Vault",   icon: FolderOpen,    num: "04" },
  { href: "/voice",   label: "Voice",   icon: Mic,           num: "05" },
  { href: "/email",   label: "Email",   icon: Mail,          num: "06" },
];

export function TabNav() {
  const pathname = usePathname();

  function navItem(href: string, label: string, Icon: React.ElementType, num: string) {
    const active = pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className="relative flex items-center gap-3 px-3 py-2.5 rounded-sm group transition-all"
        style={{
          background: active ? "var(--amber-dim)" : "transparent",
          borderLeft: active ? "2px solid var(--amber)" : "2px solid transparent",
        }}
      >
        <span
          className="font-mono text-[9px] w-4 shrink-0"
          style={{ color: active ? "var(--amber)" : "hsl(215 12% 30%)" }}
        >
          {num}
        </span>
        <Icon
          className="h-3.5 w-3.5 shrink-0 transition-colors"
          style={{ color: active ? "var(--amber)" : "hsl(215 12% 45%)" }}
        />
        <span
          className="font-mono text-[12px] tracking-wide transition-colors"
          style={{ color: active ? "var(--amber)" : "hsl(210 12% 55%)" }}
        >
          {label}
        </span>
      </Link>
    );
  }

  const settingsActive = pathname.startsWith("/settings");

  return (
    <nav className="flex flex-col px-3 py-4 gap-0.5 flex-1">
      {/* Main nav */}
      {mainTabs.map(({ href, label, icon: Icon, num }) =>
        navItem(href, label, Icon, num)
      )}

      {/* Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Divider */}
      <div className="mx-3 mb-2" style={{ height: "1px", background: "var(--line)" }} />

      {/* Settings — bottom, no number */}
      <Link
        href="/settings"
        className="relative flex items-center gap-3 px-3 py-2.5 rounded-sm group transition-all"
        style={{
          background: settingsActive ? "var(--amber-dim)" : "transparent",
          borderLeft: settingsActive ? "2px solid var(--amber)" : "2px solid transparent",
        }}
      >
        <span className="w-4 shrink-0" />
        <Settings
          className="h-3.5 w-3.5 shrink-0 transition-colors"
          style={{ color: settingsActive ? "var(--amber)" : "hsl(215 12% 40%)" }}
        />
        <span
          className="font-mono text-[12px] tracking-wide transition-colors"
          style={{ color: settingsActive ? "var(--amber)" : "hsl(210 12% 50%)" }}
        >
          Settings
        </span>
      </Link>
    </nav>
  );
}
