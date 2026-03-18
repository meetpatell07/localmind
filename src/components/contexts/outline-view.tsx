import React from "react";
import Link from "next/link";
import { ArrowRight01Icon } from "hugeicons-react";

const outlineSections = [
    {
        title: "Stack Preferences & Configuration",
        updates: [
            "User prefers TailwindCSS for styling over CSS Modules",
            "Next.js App Router is the standard over Pages Router",
            "Frequently asked about React Server Components hydration issues",
        ],
    },
    {
        title: "Recent Codebase Discussions",
        updates: [
            "Analyzed src/app/layout.tsx and suggested font optimizations",
            "Identified unoptimized images in the landing page component",
            "Discussed implementing a global Zustand store for UI state",
        ],
    },
    {
        title: "Pending Architecture Decisions",
        updates: [
            "Deciding between Supabase Auth and NextAuth.js",
            "Evaluating Drizzle ORM performance vs Prisma for vector queries",
            "Planning the ingestion pipeline for PDF documents into pgvector",
        ],
    },
    {
        title: "Extracted Action Items",
        updates: [
            "Need to update the .env.example file with the new Neon database string",
            "Fix the TypeScript compiler error regarding the missing variant property",
        ],
    },
];

export function OutlineView() {
    return (
        <div className="flex flex-col gap-6 animate-fade-in pb-24">
            {outlineSections.map((section, idx) => (
                <div key={idx} className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden p-6 hover:border-gray-200 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <div className="size-2 rounded-full bg-blue-500" />
                            {section.title}
                        </h3>
                        <Link
                            href="#"
                            className="text-xs font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
                        >
                            View Activity <ArrowRight01Icon className="size-3" />
                        </Link>
                    </div>

                    <ul className="space-y-3 pl-4">
                        {section.updates.map((update, i) => (
                            <li key={i} className="flex items-start gap-2 border-l-2 border-gray-100 pl-4 py-0.5">
                                <span className="text-[13px] text-gray-600 leading-relaxed font-medium">
                                    {update}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}
