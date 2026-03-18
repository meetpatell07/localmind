"use client";

import React, { useState } from "react";
import { SparklesIcon, Cancel01Icon, ArrowRight02Icon } from "hugeicons-react";
import { cn } from "@/lib/utils";

const suggestedPrompts = [
    "What is the tech stack?",
    "Summarize my recent thoughts",
    "What action items are pending?",
    "Did I mention database preferences?"
];

export function AskAiPopover() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={cn(
                    "fixed bottom-8 right-8 z-40 flex items-center justify-center size-14 bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all hover:scale-105",
                    isOpen && "scale-0 opacity-0 pointer-events-none"
                )}
            >
                <SparklesIcon className="size-6" />
            </button>

            {/* Popover Card */}
            <div
                className={cn(
                    "fixed bottom-8 right-8 z-50 w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right",
                    isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <SparklesIcon className="size-4 text-purple-600" />
                        Ask AI
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <Cancel01Icon className="size-4" />
                    </button>
                </div>

                {/* Body Container */}
                <div className="flex flex-col p-6 items-center flex-1">
                    <div className="size-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-4 shadow-sm border border-purple-100/50">
                        <SparklesIcon className="size-6" />
                    </div>
                    <p className="text-[15px] font-medium text-gray-600 text-center mb-6">
                        Ask anything about exactly what I know regarding this context.
                    </p>

                    <div className="w-full flex justify-end flex-col gap-2">
                        {suggestedPrompts.map((prompt, idx) => (
                            <button
                                key={idx}
                                onClick={() => setQuery(prompt)}
                                className="w-full border border-gray-200 rounded-lg p-3 text-[13px] font-medium text-gray-600 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 transition-all text-left shadow-sm"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Input Footer */}
                <div className="p-3 border-t border-gray-100 bg-white">
                    <div className="relative flex items-center w-full">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask a question..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium placeholder:text-gray-400"
                        />
                        <button
                            className={cn(
                                "absolute right-2 p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors",
                                query.trim().length > 0 && "text-purple-600"
                            )}
                        >
                            <ArrowRight02Icon className="size-5" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
