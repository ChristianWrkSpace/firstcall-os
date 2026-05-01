export default function Loading() {
  return (
    <div className="p-4 md:p-8 max-w-4xl animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-48 bg-zinc-800 rounded" />
        <div className="h-3 w-96 bg-zinc-800/60 rounded mt-2" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex gap-4"
          >
            <div className="w-8 h-8 bg-zinc-800 rounded shrink-0" />
            <div className="flex-1">
              <div className="h-3 w-24 bg-zinc-800 rounded" />
              <div className="h-4 w-3/4 bg-zinc-800 rounded mt-2" />
              <div className="h-3 w-2/3 bg-zinc-800/60 rounded mt-2" />
            </div>
            <div className="h-6 w-20 bg-zinc-800 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
