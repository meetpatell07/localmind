import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full rounded-sm border border-input bg-transparent px-3.5 h-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/40 focus:outline-none focus:ring-1 focus:ring-brand/20 transition-colors",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
