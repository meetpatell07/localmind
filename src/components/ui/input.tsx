import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full rounded-sm border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-3.5 h-9 text-sm text-[hsl(210_18%_80%)] placeholder:text-[hsl(215_12%_40%)] focus:border-[rgba(240,160,21,0.4)] focus:outline-none focus:ring-1 focus:ring-[rgba(240,160,21,0.2)] transition-colors",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
