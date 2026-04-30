// Adjuster portal: minimal layout, no sidebar.
// Public route — token in URL is the auth.

export default function AdjusterPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {children}
    </div>
  );
}
