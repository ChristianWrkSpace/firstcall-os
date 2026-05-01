export default function Loading() {
  return (
    <div className="p-4 md:p-8 max-w-3xl animate-pulse">
      <div className="mb-5">
        <div className="h-7 w-48 bg-zinc-800 rounded" />
        <div className="h-3 w-64 bg-zinc-800/60 rounded mt-2" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-28"
          />
        ))}
      </div>
    </div>
  );
}
