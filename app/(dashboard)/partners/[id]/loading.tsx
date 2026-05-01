export default function Loading() {
  return (
    <div className="p-4 md:p-8 max-w-5xl animate-pulse">
      <div className="mb-6">
        <div className="h-3 w-20 bg-zinc-800 rounded" />
        <div className="h-7 w-48 bg-zinc-800 rounded mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-24"
          />
        ))}
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-64 mb-5" />
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-48" />
    </div>
  );
}
