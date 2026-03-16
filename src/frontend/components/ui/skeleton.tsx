interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`rounded-sm ${className}`}
      style={{
        background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s linear infinite",
        ...style,
      }}
    />
  );
}

export function TaskSkeleton() {
  return (
    <div
      className="rounded-sm px-3 py-2.5 space-y-2"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
    >
      <div className="flex items-center gap-2.5">
        <Skeleton style={{ width: 14, height: 14, borderRadius: "50%" }} />
        <Skeleton style={{ height: 12, width: "60%" }} />
        <Skeleton style={{ height: 10, width: 40, marginLeft: "auto" }} />
      </div>
      <div className="flex gap-2 pl-6">
        <Skeleton style={{ height: 8, width: 32 }} />
        <Skeleton style={{ height: 8, width: 48 }} />
      </div>
    </div>
  );
}

export function PlanSkeleton() {
  return (
    <div
      className="rounded-sm p-4 space-y-3"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
    >
      <Skeleton style={{ height: 11, width: "80%" }} />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 pl-2">
          <Skeleton style={{ height: 10, width: 16, marginTop: 2 }} />
          <div className="flex-1 space-y-1.5">
            <Skeleton style={{ height: 11, width: "70%" }} />
            <Skeleton style={{ height: 9, width: "50%" }} />
          </div>
          <Skeleton style={{ height: 9, width: 28 }} />
        </div>
      ))}
    </div>
  );
}
