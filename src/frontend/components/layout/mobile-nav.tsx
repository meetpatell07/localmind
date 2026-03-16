"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, MessageSquare, Brain, CheckSquare, FolderOpen, Mic, Mail } from "lucide-react";

const tabs = [
  { href: "/chat",    label: "Chat",    icon: MessageSquare, num: "01" },
  { href: "/memory",  label: "Memory",  icon: Brain,         num: "02" },
  { href: "/planner", label: "Planner", icon: CheckSquare,   num: "03" },
  { href: "/files",   label: "Vault",   icon: FolderOpen,    num: "04" },
  { href: "/voice",   label: "Voice",   icon: Mic,           num: "05" },
  { href: "/email",   label: "Email",   icon: Mail,          num: "06" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = tabs.find((t) => pathname.startsWith(t.href));

  return (
    <>
      {/* Top bar — visible on mobile only */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--line)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] opacity-30">{current?.num}</span>
          <span className="font-mono text-[13px]" style={{ color: "var(--amber)" }}>
            {current?.label ?? "LocalMind"}
          </span>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-1.5"
          style={{ color: "hsl(215 12% 50%)" }}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Dropdown nav — mobile only */}
      {open && (
        <div
          className="md:hidden absolute top-12 left-0 right-0 z-50 flex flex-col py-2"
          style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}
        >
          {tabs.map(({ href, label, icon: Icon, num }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-5 py-3"
                style={{
                  background: active ? "var(--amber-dim)" : "transparent",
                  borderLeft: active ? "2px solid var(--amber)" : "2px solid transparent",
                }}
              >
                <span className="font-mono text-[9px] opacity-30 w-4">{num}</span>
                <Icon className="h-3.5 w-3.5" style={{ color: active ? "var(--amber)" : "hsl(215 12% 45%)" }} />
                <span className="font-mono text-[12px]" style={{ color: active ? "var(--amber)" : "hsl(210 12% 60%)" }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
