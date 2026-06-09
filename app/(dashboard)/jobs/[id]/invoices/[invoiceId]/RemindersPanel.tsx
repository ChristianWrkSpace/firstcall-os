interface Reminder {
  id: string;
  reminder_type: "gentle" | "firm" | "final";
  sent_to: string;
  sent_at: string;
  email_subject: string | null;
  sender?: { name: string } | null;
}

const TYPE_COLORS = {
  gentle: "text-ink-2",
  firm: "text-honey",
  final: "text-red-700",
};

export default function RemindersPanel({ reminders }: { reminders: Reminder[] }) {
  return (
    <section className="glass-card p-5">
      <h2 className="text-ink font-semibold mb-3">Reminder History</h2>
      <ul className="flex flex-col gap-2">
        {reminders.map((r) => (
          <li
            key={r.id}
            className="flex items-start justify-between gap-3 px-3 py-2 bg-tint rounded-lg"
          >
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-semibold capitalize ${TYPE_COLORS[r.reminder_type]}`}>
                {r.reminder_type} reminder
              </p>
              <p className="text-ink-2 text-xs mt-0.5 truncate">
                {r.email_subject ?? "(no subject)"}
              </p>
              <p className="text-ink-3 text-[10px] mt-0.5">
                to {r.sent_to}
                {r.sender?.name && ` · by ${r.sender.name}`}
              </p>
            </div>
            <p className="text-ink-3 text-xs whitespace-nowrap">
              {new Date(r.sent_at).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
