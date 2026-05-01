export default function Loading() {
  return (
    <div className="p-4 md:p-8 animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-40 bg-zinc-800 rounded" />
        <div className="h-3 w-2/3 max-w-xl bg-zinc-800/60 rounded mt-2" />
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 h-48" />
    </div>
  );
}
