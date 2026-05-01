// Instant skeleton while the job detail page server-renders.
// Pure visual — Next.js shows this the moment the user clicks a link.

export default function Loading() {
  return (
    <div className="p-4 md:p-8 animate-pulse">
      <div className="mb-6">
        <div className="h-3 w-16 bg-zinc-800 rounded" />
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <div className="h-7 w-40 bg-zinc-800 rounded" />
          <div className="h-5 w-16 bg-zinc-800 rounded-full" />
          <div className="h-5 w-24 bg-zinc-800 rounded-full" />
        </div>
        <div className="h-3 w-64 bg-zinc-800 rounded mt-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <SkeletonCard h="h-40" />
          <SkeletonCard h="h-64" />
          <SkeletonCard h="h-48" />
        </div>
        <div className="flex flex-col gap-5">
          <SkeletonCard h="h-40" />
          <SkeletonCard h="h-32" />
          <SkeletonCard h="h-40" />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard({ h }: { h: string }) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-6 ${h}`}>
      <div className="h-4 w-24 bg-zinc-800 rounded mb-4" />
      <div className="h-3 w-full bg-zinc-800/60 rounded mb-2" />
      <div className="h-3 w-5/6 bg-zinc-800/60 rounded mb-2" />
      <div className="h-3 w-2/3 bg-zinc-800/60 rounded" />
    </div>
  );
}
