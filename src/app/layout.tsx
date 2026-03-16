import type { Metadata } from "next";
import "./globals.css";
import { TabNav } from "@/frontend/components/layout/tab-nav";
import { Brain } from "lucide-react";

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
      <body className="flex h-screen overflow-hidden font-body">
        {/* Skip to main content — accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
        >
          Skip to main content
        </a>

        {/* Sidebar */}
        <aside className="w-56 shrink-0 flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm relative">
          {/* Gradient border effect */}
          <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />

          {/* Logo */}
          <div className="px-5 py-5 border-b border-border/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/90 to-accent/70 flex items-center justify-center shadow-lg shadow-primary/20">
                <Brain className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-base font-heading font-bold text-foreground tracking-tight">
                  LocalMind
                </h1>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                  Personal AI
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <TabNav />

          {/* Bottom section */}
          <div className="mt-auto px-4 py-4 border-t border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center text-xs font-heading font-bold text-foreground">
                M
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Meet</p>
                <p className="text-[10px] text-muted-foreground">Local · Online</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main id="main-content" className="flex-1 overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
