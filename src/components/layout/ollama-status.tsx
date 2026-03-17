"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          online === null && "bg-gray-400",
          online === true && "bg-green-500",
          online === false && "bg-red-400",
        )}
      />
      <span className="text-sm text-muted-foreground">
        {online === null ? "..." : online ? "online" : "offline"}
      </span>
    </div>
  );
}
