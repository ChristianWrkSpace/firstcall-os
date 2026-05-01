export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950 animate-pulse">
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="h-9 w-44 bg-zinc-800 rounded" />
          <div className="h-9 w-20 bg-zinc-800 rounded" />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-5">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-32" />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-48" />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-40" />
      </main>
    </div>
  );
}
