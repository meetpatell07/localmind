"use client";

import Link from "next/link";
import { AGENT_DEFINITIONS } from "@/agent/agent-definitions";
import type { AgentDefinition } from "@/agent/agent-definitions";
import { ArrowRight02Icon, CheckListIcon } from "hugeicons-react";
import { cn } from "@/lib/utils";

// Color accent map for border + text
const colorMap: Record<string, { border: string; dot: string; badge: string }> = {
  blue:   { border: "border-blue-200",   dot: "bg-blue-500",   badge: "bg-blue-50 text-blue-700" },
  emerald:{ border: "border-emerald-200",dot: "bg-emerald-500",badge: "bg-emerald-50 text-emerald-700" },
  violet: { border: "border-violet-200", dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700" },
  amber:  { border: "border-amber-200",  dot: "bg-amber-500",  badge: "bg-amber-50 text-amber-700" },
  pink:   { border: "border-pink-200",   dot: "bg-pink-500",   badge: "bg-pink-50 text-pink-700" },
  cyan:   { border: "border-cyan-200",   dot: "bg-cyan-500",   badge: "bg-cyan-50 text-cyan-700" },
  orange: { border: "border-orange-200", dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700" },
  teal:   { border: "border-teal-200",   dot: "bg-teal-500",   badge: "bg-teal-50 text-teal-700" },
  indigo: { border: "border-indigo-200", dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700" },
};

function AgentCard({ agent }: { agent: AgentDefinition }) {
  const colors = colorMap[agent.color] ?? colorMap.blue;

  return (
    <Link
      href={`/agents/${agent.id}`}
      className={cn(
        "group flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm",
        "hover:shadow-md hover:border-gray-300 transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-300"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Color dot */}
          <span className={cn("size-2.5 rounded-full shrink-0 mt-0.5", colors.dot)} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 leading-tight truncate">
              {agent.name}
            </h3>
            <p className={cn("mt-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full inline-block", colors.badge)}>
              {agent.role}
            </p>
          </div>
        </div>
        <ArrowRight02Icon
          className="size-4 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors mt-0.5"
          strokeWidth={2}
        />
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
        {agent.description}
      </p>

      {/* Capabilities */}
      <ul className="flex flex-col gap-1.5">
        {agent.capabilities.map((cap) => (
          <li key={cap} className="flex items-start gap-2 text-xs text-gray-600">
            <span className={cn("size-1 rounded-full shrink-0 mt-1.5", colors.dot)} />
            {cap}
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="mt-auto pt-2 border-t border-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {agent.toolKeys.length} tool{agent.toolKeys.length !== 1 ? "s" : ""}
        </span>
        <span className="text-xs font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
          Open →
        </span>
      </div>
    </Link>
  );
}

export default function AgentsPage() {
  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className={cn(
            "size-8 rounded-lg flex items-center justify-center bg-gray-100"
          )}>
            <CheckListIcon className="size-4 text-gray-600" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Agents</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {AGENT_DEFINITIONS.length} specialized agents — click any to start a conversation
            </p>
          </div>
        </div>
      </div>

      {/* Agent grid */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
          {AGENT_DEFINITIONS.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}
