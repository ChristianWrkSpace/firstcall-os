export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-zinc-400 text-sm">Welcome to FirstCall OS</p>

      <div className="grid grid-cols-2 gap-4 mt-8 lg:grid-cols-4">
        {[
          { label: "Active Jobs", value: "—" },
          { label: "Open Leads", value: "—" },
          { label: "Customers", value: "—" },
          { label: "Calls Today", value: "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
          >
            <p className="text-zinc-400 text-sm">{stat.label}</p>
            <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
