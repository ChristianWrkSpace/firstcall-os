export default function Loading() {
  return (
    <div className="min-h-screen bg-card animate-pulse">
      <header className="bg-card border-b-2 border-blue-600 px-6 py-5">
        <div className="max-w-3xl mx-auto h-9 w-44 bg-shade rounded" />
      </header>
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-6">
        <div>
          <div className="h-7 w-72 bg-shade rounded" />
          <div className="h-3 w-64 bg-shade rounded mt-2" />
        </div>
        <div className="bg-card border border-edge2 rounded-xl p-6 h-72" />
        <div className="bg-white rounded-lg p-8 h-96" />
      </main>
    </div>
  );
}
