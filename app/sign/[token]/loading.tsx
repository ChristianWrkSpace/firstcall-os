export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950 animate-pulse">
      <header className="bg-zinc-900 border-b-2 border-blue-600 px-6 py-5">
        <div className="max-w-3xl mx-auto h-9 w-44 bg-zinc-800 rounded" />
      </header>
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-6">
        <div>
          <div className="h-7 w-72 bg-zinc-800 rounded" />
          <div className="h-3 w-64 bg-zinc-800/60 rounded mt-2" />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-72" />
        <div className="bg-white rounded-lg p-8 h-96" />
      </main>
    </div>
  );
}
