// Immediate route-group fallback for dashboard pages that do not provide a
// more specific skeleton. The persistent sidebar stays interactive while the
// destination streams from the server.
export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-8 animate-pulse" aria-label="Loading page">
      <div className="flex items-center justify-between gap-4 mb-7">
        <div>
          <div className="h-7 w-44 rounded-lg bg-shade" />
          <div className="h-3 w-64 max-w-[70vw] rounded bg-shade mt-2" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-shade" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass-card p-4 h-24">
            <div className="h-3 w-20 rounded bg-shade mb-3" />
            <div className="h-7 w-16 rounded bg-shade" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 glass-card p-5 h-72">
          <div className="h-4 w-32 rounded bg-shade mb-5" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 rounded-lg bg-shade mb-2" />
          ))}
        </div>
        <div className="glass-card p-5 h-72">
          <div className="h-4 w-24 rounded bg-shade mb-5" />
          <div className="h-20 rounded-lg bg-shade mb-3" />
          <div className="h-20 rounded-lg bg-shade" />
        </div>
      </div>
    </div>
  );
}
