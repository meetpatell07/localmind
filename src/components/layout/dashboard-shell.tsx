"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { PanelLeftIcon } from "hugeicons-react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex h-screen">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main className="flex-1 overflow-auto md:ml-64 bg-gray-50">
        <div className="md:hidden px-4 pt-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            <PanelLeftIcon className="size-4" strokeWidth={2} />
          </Button>
        </div>
        <section className="md:px-8 px-4 py-4 mb-8">{children}</section>
      </main>
    </div>
  );
}
