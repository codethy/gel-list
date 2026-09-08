// app/sets/[id]/loading.tsx

export default function SetDetailLoading() {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="animate-pulse">

        {/* Back button skeleton */}
        <div className="px-6 pt-6">
          <div className="h-8 w-24 rounded-md bg-muted" />
        </div>

        {/* Header skeleton */}
        <div className="flex flex-col items-center gap-6 px-6 pt-8 pb-12">
          {/* Set image */}
          <div className="h-48 w-48 rounded-2xl bg-muted" />

          {/* Set name */}
          <div className="h-10 w-96 rounded-lg bg-muted" />

          {/* Info bubbles */}
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 w-36 rounded-xl bg-muted" />
            ))}
          </div>
        </div>

        {/* Your Gels skeleton */}
        <div className="px-6 pb-10">
          <div className="h-6 w-32 rounded bg-muted mb-4" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 w-28 rounded-xl bg-muted flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Checklist skeleton */}
        <div className="px-6">
          {/* Search bar */}
          <div className="h-12 w-1/2 rounded-xl bg-muted mb-6" />

          {/* Table rows */}
          <div className="flex flex-col gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-14 w-full rounded-lg bg-muted" />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
