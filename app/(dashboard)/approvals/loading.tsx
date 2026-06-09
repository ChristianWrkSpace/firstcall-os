export default function Loading() {
  return (
    <div className="p-4 md:p-8 max-w-4xl animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-48 bg-shade rounded" />
        <div className="h-3 w-96 bg-shade rounded mt-2" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="glass-card p-5 flex gap-4"
          >
            <div className="w-8 h-8 bg-shade rounded shrink-0" />
            <div className="flex-1">
              <div className="h-3 w-24 bg-shade rounded" />
              <div className="h-4 w-3/4 bg-shade rounded mt-2" />
              <div className="h-3 w-2/3 bg-shade rounded mt-2" />
            </div>
            <div className="h-6 w-20 bg-shade rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
