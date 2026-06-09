export default function Loading() {
  return (
    <div className="p-4 md:p-8 max-w-5xl animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-48 bg-shade rounded" />
        <div className="h-3 w-3/4 max-w-xl bg-shade rounded mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 bg-card border border-edge2 rounded-lg"
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-16 bg-card border border-edge2 rounded-lg"
          />
        ))}
      </div>
    </div>
  );
}
