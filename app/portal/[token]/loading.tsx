export default function Loading() {
  return (
    <div className="min-h-screen app-backdrop animate-pulse">
      <header className="bg-card border-b border-edge2 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="h-9 w-44 bg-shade rounded" />
          <div className="h-9 w-20 bg-shade rounded" />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-5">
        <div className="bg-card border border-edge2 rounded-xl p-6 h-32" />
        <div className="bg-card border border-edge2 rounded-xl p-6 h-48" />
        <div className="bg-card border border-edge2 rounded-xl p-6 h-40" />
      </main>
    </div>
  );
}
