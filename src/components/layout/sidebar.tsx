"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageMultiple01Icon,
  AiBrain02Icon,
  CheckListIcon,
  Folder01Icon,
  Mic01Icon,
  Mail01Icon,
  Setting07Icon,
} from "hugeicons-react";
import { OllamaStatus } from "@/components/layout/ollama-status";

const sidebarItems = [
  { label: "Chat", path: "/chat", icon: MessageMultiple01Icon },
  { label: "Memory", path: "/memory", icon: AiBrain02Icon },
  { label: "Planner", path: "/planner", icon: CheckListIcon },
  { label: "Vault", path: "/files", icon: Folder01Icon },
  { label: "Voice", path: "/voice", icon: Mic01Icon },
  { label: "Email", path: "/email", icon: Mail01Icon },
];

const bottomSidebarItems = [
  { label: "Settings", path: "/settings", icon: Setting07Icon },
];

interface SidebarProps {
  readonly mobileOpen?: boolean;
  readonly onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + "/");
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-2 bg-gray-50 backdrop-blur-xl md:hidden transition-all duration-100 linear",
          mobileOpen
            ? "opacity-100 backdrop-blur-xl"
            : "opacity-0 backdrop-blur-none pointer-events-none",
        )}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed z-40 flex flex-col bg-background border-r p-4 transition-all duration-100 linear",
          "h-dvh w-64",
          "transform -translate-x-full md:translate-x-0",
          mobileOpen && "translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-2 font-medium">
            <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              L
            </span>
            <span>LocalMind</span>
          </div>

          <div className="flex-1 mt-2 flex flex-col overflow-hidden">
            <nav aria-label="Primary" className="flex flex-col">
              <ul className="space-y-0.5">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  return (
                    <li key={item.label}>
                      <Link
                        href={item.path}
                        onClick={() => {
                          if (mobileOpen) onMobileClose?.();
                        }}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-lg text-left hover:bg-gray-50 active:bg-gray-100",
                          active && "bg-gray-50 text-foreground",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition">
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              active
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </span>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            active
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="mt-auto pt-2">
              <ul className="space-y-0.5">
                {bottomSidebarItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  return (
                    <li key={item.label}>
                      <Link
                        href={item.path}
                        onClick={() => {
                          if (mobileOpen) onMobileClose?.();
                        }}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-lg text-left hover:bg-gray-50 active:bg-gray-100",
                          active && "bg-gray-50 text-foreground",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition">
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              active
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </span>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            active
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Bottom user section */}
          <div className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="size-7 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 shrink-0">
              M
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">Meet</p>
            </div>
            <OllamaStatus />
          </div>
        </div>
      </aside>
    </>
  );
}
