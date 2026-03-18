import React from "react";
import { FolderOpenIcon, ArrowLeft02Icon, SparklesIcon, File01Icon, Settings02Icon, Activity01Icon, ListViewIcon } from "hugeicons-react";
import Link from "next/link";
import { OutlineView } from "@/components/contexts/outline-view";
import { AskAiPopover } from "@/components/contexts/ask-ai-popover";
import { FilesView } from "@/components/contexts/files-view";

// Dummy parameter interface standard for Next App Router
export default function ContextPage({ params, searchParams }: any) {
    // Hardcoded for demo 'Engineering' context
    const tab = searchParams?.tab || "outline";

    return (
        <div className="flex flex-col h-full w-full max-w-5xl mx-auto animate-fade-in relative">
            {/* Header Area */}
            <div className="flex items-center gap-3 pt-4 pb-6 border-b border-gray-100">
                <Link href="/overview" className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors">
                    <ArrowLeft02Icon className="size-5" />
                </Link>
                <div className="flex items-center justify-center size-8 rounded-full bg-blue-100 text-blue-600 shrink-0">
                    <FolderOpenIcon className="size-4" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-gray-900">Engineering</h1>
            </div>

            {/* Tabs Row */}
            <div className="flex items-center gap-6 border-b border-gray-100 overflow-x-auto no-scrollbar pt-4">
                <TabLink id="outline" currentTab={tab} label="Memory Outline" icon={ListViewIcon} />
                <TabLink id="activity" currentTab={tab} label="Activity" icon={Activity01Icon} />
                <TabLink id="files" currentTab={tab} label="Files" icon={File01Icon} />
                <TabLink id="settings" currentTab={tab} label="Settings" icon={Settings02Icon} />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto py-6 relative">
                {tab === "outline" && <OutlineView />}
                {tab === "files" && <FilesView />}
                {tab === "activity" && <div className="text-sm text-gray-500">Activity view coming soon...</div>}
                {tab === "settings" && <div className="text-sm text-gray-500">Settings coming soon...</div>}
            </div>

            {/* Ask AI Floating Popover */}
            <AskAiPopover />
        </div>
    );
}

function TabLink({ id, currentTab, label, icon: Icon }: any) {
    const isActive = currentTab === id;
    return (
        <Link
            href={`?tab=${id}`}
            className={`group flex items-center gap-2 pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${isActive ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
        >
            {Icon && (
                <Icon
                    className={`size-4 transition-colors ${isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                        }`}
                />
            )}
            {label}
            {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 rounded-t-full" />
            )}
        </Link>
    );
}
