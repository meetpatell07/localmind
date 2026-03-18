"use client";

import React, { useState } from "react";
import {
    Search02Icon,
    MessageMultiple01Icon,
    AiBrain02Icon,
    CheckListIcon,
    Folder01Icon,
    Mic01Icon,
    Mail01Icon
} from "hugeicons-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const tabs = [
    { id: "all", label: "All Sources", icon: null },
    { id: "chat", label: "Chat", icon: MessageMultiple01Icon, color: "text-blue-500" },
    { id: "memory", label: "Memory", icon: AiBrain02Icon, color: "text-purple-500" },
    { id: "planner", label: "Planner", icon: CheckListIcon, color: "text-emerald-500" },
    { id: "vault", label: "Vault", icon: Folder01Icon, color: "text-amber-500" },
    { id: "voice", label: "Voice", icon: Mic01Icon, color: "text-rose-500" },
    { id: "email", label: "Email", icon: Mail01Icon, color: "text-red-500" },
];

const mockEvents = [
    {
        id: "1",
        time: "8:14 PM",
        source: "memory",
        tag: "LocalMind",
        senderInitial: "AI",
        senderInitialColor: "bg-purple-100 text-purple-700",
        senderName: "Agent Memory",
        senderEmail: "Core Knowledge",
        recipient: "Local Context",
        subject: "New core memory extracted from chat",
        body: "Distilled a new core memory regarding your preferred frontend stack. 'User prefers using TailwindCSS with Next.js App Router and framer-motion for animations'.",
        sourceIcon: AiBrain02Icon,
        sourceColor: "text-purple-500 bg-purple-50"
    },
    {
        id: "2",
        time: "3:03 PM",
        source: "vault",
        tag: "System",
        senderInitial: "V",
        senderInitialColor: "bg-amber-100 text-amber-700",
        senderName: "Local Vault",
        senderEmail: "Filesystem",
        recipient: "Indexed",
        subject: "Q3_Financial_Report.pdf analyzed",
        body: "Successfully ingested and embedded 42 pages from your recently uploaded PDF. Ready for RAG querying across your financial history.",
        sourceIcon: Folder01Icon,
        sourceColor: "text-amber-500 bg-amber-50"
    },
    {
        id: "3",
        time: "2:18 PM",
        source: "planner",
        tag: "Tasks",
        senderInitial: "P",
        senderInitialColor: "bg-emerald-100 text-emerald-700",
        senderName: "Task Planner",
        senderEmail: "local.agent",
        recipient: "Meet",
        subject: "Action required: High priority sprint tasks pending",
        body: "You have 3 unchecked items in the 'Landing Page Redesign' milestone. The deadline is approaching in 2 days. Shall I draft the boilerplate code?",
        sourceIcon: CheckListIcon,
        sourceColor: "text-emerald-500 bg-emerald-50"
    },
];

export default function OverviewPage() {
    const [activeTab, setActiveTab] = useState("all");

    return (
        <div className="flex flex-col h-full w-full max-w-5xl mx-auto pt-4 pb-12 animate-fade-in">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Overview</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Here&apos;s what&apos;s been happening across your projects.
                    </p>
                </div>
                <div className="relative w-full md:w-64 shrink-0">
                    <Search02Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                        placeholder="Search..."
                        className="w-full pl-9 pr-12 bg-white border-gray-200 shadow-sm focus-visible:ring-gray-200 rounded-lg h-9"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <kbd className="inline-flex h-5 items-center justify-center rounded border bg-gray-50 px-1 text-[10px] font-medium text-gray-500">
                            <span className="text-xs">⌘</span>K
                        </kbd>
                    </div>
                </div>
            </div>

            {/* Tabs Row */}
            <div className="flex items-center gap-6 border-b border-gray-100 mb-6 overflow-x-auto no-scrollbar pb-px">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "group flex items-center gap-2 pb-3 text-sm font-medium transition-colors relative whitespace-nowrap",
                                isActive ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            {Icon && (
                                <Icon
                                    className={cn(
                                        "size-4 transition-colors",
                                        isActive ? tab.color : "text-gray-400 group-hover:text-gray-600"
                                    )}
                                />
                            )}
                            {tab.label}
                            {isActive && (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 rounded-t-full" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Secondary Filters */}
            <div className="flex items-center gap-2 mb-8">
                <button className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-full transition-colors">
                    All Projects
                </button>
                <button className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-full flex items-center gap-1.5 shadow-sm transition-colors">
                    <div className="size-2 rounded-full bg-blue-600" />
                    Timeline
                </button>
            </div>

            {/* Timeline Feed */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                        TODAY
                    </h3>
                    <div className="flex flex-col border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
                        {mockEvents.map((event) => (
                            <div
                                key={event.id}
                                className="p-4 md:p-5 flex flex-col gap-1 hover:bg-gray-50/50 transition-colors group cursor-pointer"
                            >
                                {/* Meta Row */}
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500 font-medium w-14 shrink-0">{event.time}</span>
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50/50 border border-blue-100 text-[10px] font-medium text-blue-600">
                                            <div className="size-1.5 rounded-full bg-blue-600" />
                                            {event.tag}
                                        </span>
                                    </div>
                                    {event.sourceIcon && (
                                        <div className={cn("flex items-center justify-center p-1 rounded-md hidden md:flex", event.sourceColor)}>
                                            <event.sourceIcon className="size-4" />
                                        </div>
                                    )}
                                </div>

                                {/* Sender Info Row */}
                                <div className="flex items-center gap-3 w-full">
                                    <div className="w-14 shrink-0 flex justify-end pr-2 md:pr-0">
                                        <div className={cn(
                                            "size-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 shadow-sm",
                                            event.senderInitialColor || "bg-indigo-100 text-indigo-700"
                                        )}>
                                            {event.senderInitial}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-1.5 mb-0.5">
                                            <span className="text-sm font-semibold text-gray-900 truncate">{event.senderName}</span>
                                            <span className="text-[13px] text-gray-500 truncate">{event.senderEmail}</span>
                                        </div>
                                        <div className="text-[13px] text-gray-500 flex items-center gap-1 truncate">
                                            To: <span className="text-gray-700">{event.recipient}</span>
                                        </div>
                                    </div>
                                    {event.sourceIcon && (
                                        <div className={cn("flex md:hidden flex-shrink-0 items-center justify-center p-1 rounded-md", event.sourceColor)}>
                                            <event.sourceIcon className="size-4" />
                                        </div>
                                    )}
                                </div>

                                {/* Content Row */}
                                <div className="flex">
                                    <div className="w-14 shrink-0 hidden md:block" />
                                    <div className="flex-1 min-w-0 md:pl-3 pt-2">
                                        <p className="text-[14px] font-semibold text-gray-900 mb-1 leading-snug">
                                            {event.subject}
                                        </p>
                                        <p className="text-[14px] text-gray-600 line-clamp-2 leading-relaxed">
                                            {event.body}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
