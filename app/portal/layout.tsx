// Customer portal: minimal layout, no sidebar, no app chrome.
// Public route — no auth required (token in URL is the auth).

export default function PortalLayout({
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
