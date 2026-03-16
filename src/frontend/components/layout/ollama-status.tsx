"use client";

import { useEffect, useState } from "react";

export function OllamaStatus() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/health", { signal: AbortSignal.timeout(3000) });
        if (!cancelled) setOnline(res.ok);
      } catch {
        if (!cancelled) setOnline(false);
      }
    }

    check();
    const id = setInterval(check, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: online === null
            ? "hsl(215 12% 30%)"
            : online
            ? "rgba(52, 211, 153, 0.8)"
            : "rgba(248, 113, 113, 0.8)",
          boxShadow: online
            ? "0 0 6px rgba(52,211,153,0.4)"
            : online === false
            ? "0 0 6px rgba(248,113,113,0.3)"
            : "none",
          animation: online ? "pulse 2s ease-in-out infinite" : "none",
        }}
      />
      <span className="font-mono text-[9px] opacity-30">
        {online === null ? "checking..." : online ? "ollama online" : "ollama offline"}
      </span>
    </div>
  );
}
