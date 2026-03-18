import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-gray-100 animate-pulse",
        className,
      )}
    />
  );
}

export function TaskSkeleton() {
  return (
    <div className="rounded-lg px-3.5 py-3 bg-white border border-gray-100 space-y-2.5">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-3.5 w-3/5" />
      </div>
      <div className="flex gap-2 pl-6">
        <Skeleton className="h-4 w-12 rounded-md" />
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>
    </div>
  );
}

export function PlanSkeleton() {
  return (
    <div className="space-y-3 py-1">
      <Skeleton className="h-3.5 w-4/5" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 pl-2">
          <Skeleton className="h-3 w-5 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}
