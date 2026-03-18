"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NeuralNetworkIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Search02Icon,
} from "hugeicons-react";
import { cn } from "@/lib/utils";

interface Relationship {
  predicate: string;
  objectValue: string | null;
  confidence: number;
}

interface Entity {
  id: string;
  name: string;
  type: string;
  mentionCount: number | null;
  firstSeen: string;
  lastSeen: string;
  relationships: Relationship[];
}

interface EntityListProps {
  entities: Entity[];
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  person:       { bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-100" },
  project:      { bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-100" },
  technology:   { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
  concept:      { bg: "bg-purple-50",  text: "text-purple-600",  border: "border-purple-100" },
  place:        { bg: "bg-orange-50",  text: "text-orange-600",  border: "border-orange-100" },
  organization: { bg: "bg-yellow-50",  text: "text-yellow-600",  border: "border-yellow-100" },
  event:        { bg: "bg-red-50",     text: "text-red-600",     border: "border-red-100" },
  other:        { bg: "bg-gray-50",    text: "text-gray-500",    border: "border-gray-200" },
};

export function EntityList({ entities }: EntityListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const filtered = entities.filter(
    (e) =>
      !filter ||
      e.name.toLowerCase().includes(filter.toLowerCase()) ||
      e.type.toLowerCase().includes(filter.toLowerCase())
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2.5">
          <NeuralNetworkIcon className="size-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Entities
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-900 text-white">
            {entities.length}
          </span>
        </div>
        <div className="relative w-28">
          <Search02Icon className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-gray-400" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter..."
            className="bg-white border-gray-200 text-sm h-7 pl-7 pr-2 rounded-lg focus-visible:ring-gray-200"
          />
        </div>
      </div>

      {/* Table */}
      <div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <NeuralNetworkIcon className="size-8 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {filter ? "No matches" : "No entities yet — start chatting"}
            </p>
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div className="grid px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100"
              style={{ gridTemplateColumns: "1fr 80px 60px" }}
            >
              <span>Name / Type</span>
              <span className="text-right">Last Seen</span>
              <span className="text-right">Mentions</span>
            </div>

            <div className="divide-y divide-gray-100">
              {filtered.map((entity) => {
                const isOpen = expanded.has(entity.id);
                const colors = TYPE_COLORS[entity.type] ?? TYPE_COLORS.other;

                return (
                  <div key={entity.id}>
                    {/* Row */}
                    <Button
                      variant="ghost"
                      className="w-full text-left grid px-4 py-2.5 h-auto rounded-none hover:bg-gray-50/50 transition-colors"
                      style={{ gridTemplateColumns: "1fr 80px 60px" }}
                      onClick={() => toggle(entity.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {entity.relationships.length > 0
                          ? isOpen
                            ? <ArrowDown01Icon className="size-3 shrink-0 text-gray-400" />
                            : <ArrowRight01Icon className="size-3 shrink-0 text-gray-400" />
                          : <span className="w-3 shrink-0" />
                        }
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {entity.name}
                        </span>
                        <span className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0",
                          colors.bg, colors.text, colors.border
                        )}>
                          {entity.type}
                        </span>
                      </div>
                      <span className="text-xs text-right self-center text-gray-400">
                        {new Date(entity.lastSeen).toLocaleDateString("en", { month: "short", day: "numeric" })}
                      </span>
                      <span className="text-xs text-right self-center font-semibold text-gray-900">
                        {entity.mentionCount ?? 1}
                      </span>
                    </Button>

                    {/* Relationships */}
                    {isOpen && entity.relationships.length > 0 && (
                      <div className="px-10 py-2.5 space-y-1.5 bg-gray-50/50 border-t border-gray-100">
                        {entity.relationships.map((rel, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-300">↳</span>
                            <span className="text-gray-500 font-medium">{rel.predicate}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-gray-700">{rel.objectValue}</span>
                            <span className="ml-auto text-gray-300 text-[10px]">
                              {Math.round((rel.confidence ?? 0.8) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
