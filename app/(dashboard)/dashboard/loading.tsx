export default function Loading() {
  return (
    <div className="p-4 md:p-8 animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-32 bg-zinc-800 rounded" />
        <div className="h-3 w-64 bg-zinc-800/60 rounded mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-28"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-64" />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-64" />
      </div>
    </div>
  );
}
