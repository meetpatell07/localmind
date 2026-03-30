export const runtime = 'edge';

import React from "react";
import {
  FolderOpenIcon,
  ArrowLeft02Icon,
  File01Icon,
  Settings02Icon,
  Activity01Icon,
  ListViewIcon,
  MessageMultiple01Icon,
  AiBrain02Icon,
} from "hugeicons-react";
import Link from "next/link";
import { OutlineView } from "@/components/contexts/outline-view";
import { AskAiPopover } from "@/components/contexts/ask-ai-popover";
import { FilesView } from "@/components/contexts/files-view";

interface ContextPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ContextPage({ params, searchParams }: ContextPageProps) {
  const { id } = await params;
  const { tab = "outline" } = await searchParams;

  // Derive display name from URL slug (e.g. "engineering" → "Engineering")
  const contextName = id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto animate-fade-in relative">
      {/* Header */}
      <div className="flex items-center gap-3 pt-4 pb-6 border-b border-gray-100">
        <Link
          href="/overview"
          className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft02Icon className="size-5" />
        </Link>
        <div className="flex items-center justify-center size-8 rounded-full bg-blue-100 text-blue-600 shrink-0">
          <FolderOpenIcon className="size-4" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-gray-900">{contextName}</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-gray-100 overflow-x-auto no-scrollbar pt-4">
        <TabLink id="outline" currentTab={tab} label="Memory Outline" icon={ListViewIcon} />
        <TabLink id="activity" currentTab={tab} label="Activity" icon={Activity01Icon} />
        <TabLink id="files" currentTab={tab} label="Files" icon={File01Icon} />
        <TabLink id="settings" currentTab={tab} label="Settings" icon={Settings02Icon} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-6 relative">
        {tab === "outline" && <OutlineView />}
        {tab === "files" && <FilesView />}
        {tab === "activity" && <ActivityTab contextName={contextName} />}
        {tab === "settings" && <SettingsTab contextId={id} contextName={contextName} />}
      </div>

      <AskAiPopover contextName={contextName} />
    </div>
  );
}

// ── Tab link ──────────────────────────────────────────────────────────────────

interface TabLinkProps {
  id: string;
  currentTab: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

function TabLink({ id, currentTab, label, icon: Icon }: TabLinkProps) {
  const isActive = currentTab === id;
  return (
    <Link
      href={`?tab=${id}`}
      className={`group flex items-center gap-2 pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
        isActive ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <Icon
        className={`size-4 transition-colors ${
          isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
        }`}
        strokeWidth={1.5}
      />
      {label}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 rounded-t-full" />
      )}
    </Link>
  );
}

// ── Activity tab ──────────────────────────────────────────────────────────────

function ActivityTab({ contextName }: { contextName: string }) {
  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-24">
      <div className="border border-gray-100 rounded-xl bg-white shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Context Activity</h3>
        <p className="text-sm text-gray-500 mb-6">
          Conversations and memory events scoped to the{" "}
          <span className="font-medium text-gray-700">{contextName}</span> context.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/chat"
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:border-blue-200 hover:bg-blue-50/40 transition-all group"
          >
            <div className="size-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <MessageMultiple01Icon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                Open Chat
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Start a conversation in this context
              </p>
            </div>
          </Link>
          <Link
            href="/memory"
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:border-purple-200 hover:bg-purple-50/40 transition-all group"
          >
            <div className="size-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <AiBrain02Icon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">
                View Memory
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Browse entities and knowledge graph
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab({ contextId, contextName }: { contextId: string; contextName: string }) {
  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-24 max-w-lg">
      <div className="border border-gray-100 rounded-xl bg-white shadow-sm divide-y divide-gray-100 overflow-hidden">
        <div className="p-6">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Context Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <div className="text-sm font-medium text-gray-900 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                {contextName}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">URL Slug</label>
              <div className="text-sm font-mono text-gray-600 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                /contexts/{contextId}
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          <p className="text-xs text-gray-400 leading-relaxed">
            Context settings allow you to scope memory, files, and conversations to a specific
            project or topic. Full context configuration will be available in a future release.
          </p>
        </div>
      </div>
    </div>
  );
}
