import Link from "next/link";
import Logo from "@/components/Logo";

// Branded 404 — a wrong link should still feel like FirstCall, and always
// offer a way back to work.
export default function NotFound() {
  return (
    <div className="min-h-screen app-backdrop flex items-center justify-center p-6">
      <div className="glass-card max-w-sm w-full p-8 text-center">
        <div className="flex justify-center mb-5">
          <Logo variant="mark" size={40} />
        </div>
        <h1 className="text-ink text-xl font-semibold">Page not found</h1>
        <p className="text-ink-3 text-sm mt-2 leading-relaxed">
          This link doesn&apos;t go anywhere — the job, doc, or page may have
          moved or been removed.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/canvas"
            className="w-full py-2.5 rounded-xl bg-cta hover:bg-cta-deep text-white text-sm font-medium transition-colors"
          >
            Back to Command Center
          </Link>
          <Link
            href="/jobs"
            className="w-full py-2.5 rounded-xl bg-shade hover:bg-edge2 text-ink text-sm font-medium transition-colors"
          >
            View jobs
          </Link>
        </div>
      </div>
    </div>
  );
}
