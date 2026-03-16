import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TabNav } from "@/frontend/components/layout/tab-nav";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} flex h-screen overflow-hidden`}>
        {/* Sidebar */}
        <aside className="w-48 shrink-0 flex flex-col border-r border-border bg-card">
          <div className="px-4 py-4 border-b border-border">
            <h1 className="text-lg font-bold text-primary">LocalMind</h1>
            <p className="text-xs text-muted-foreground">Personal AI</p>
          </div>
          <TabNav />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
