import type { Metadata } from "next";
import "./globals.css";
import { TabNav } from "@/frontend/components/layout/tab-nav";
import { OllamaStatus } from "@/frontend/components/layout/ollama-status";
import { MobileNav } from "@/frontend/components/layout/mobile-nav";

export const metadata: Metadata = {
  title: "LocalMind",
  description: "Personal AI agent for Meet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="flex h-screen overflow-hidden"
        style={{ background: "var(--navy)", color: "hsl(210 18% 80%)" }}
      >
        {/* Sidebar — hidden on mobile */}
        <aside
          className="hidden md:flex w-52 shrink-0 flex-col"
          style={{
            background: "var(--surface)",
            borderRight: "1px solid var(--line)",
          }}
        >
          {/* Logo */}
          <div
            className="px-5 py-5"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-sm flex items-center justify-center shrink-0"
                style={{ background: "var(--amber-dim)", border: "1px solid rgba(240,160,21,0.2)" }}
              >
                <span style={{ color: "var(--amber)", fontSize: "14px", fontFamily: "var(--font-mono, monospace)" }}>
                  ◈
                </span>
              </div>
              <div>
                <p
                  className="font-mono text-[13px] tracking-wider"
                  style={{ color: "hsl(210 18% 88%)" }}
                >
                  LocalMind
                </p>
                <p
                  className="font-mono text-[9px] tracking-widest uppercase opacity-30"
                >
                  personal ai
                </p>
              </div>
            </div>
          </div>

          {/* Nav — flex-1 so Settings floats to bottom */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <TabNav />
          </div>

          {/* Bottom — Ollama status + user */}
          <div
            className="mt-auto px-4 py-4 space-y-3"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <OllamaStatus />
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-sm flex items-center justify-center font-mono text-[11px] shrink-0"
                style={{
                  background: "var(--amber-dim)",
                  color: "var(--amber)",
                  border: "1px solid rgba(240,160,21,0.2)",
                }}
              >
                M
              </div>
              <div>
                <p className="font-mono text-[11px]" style={{ color: "hsl(210 18% 70%)" }}>
                  Meet
                </p>
                <p className="font-mono text-[9px] opacity-25">localhost</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main
          id="main-content"
          className="flex-1 overflow-hidden flex flex-col"
          style={{ background: "var(--navy)" }}
        >
          {/* Mobile top bar */}
          <MobileNav />
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
