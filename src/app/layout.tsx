import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const metadata: Metadata = {
  title: "LocalMind",
  description: "Personal AI agent for Meet",
};

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.className} antialiased bg-background`}>
        <DashboardShell>{children}</DashboardShell>
        <Toaster closeButton />
      </body>
    </html>
  );
}
