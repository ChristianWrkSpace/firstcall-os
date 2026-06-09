import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-helpers";
import { listMfaFactors } from "@/app/actions/mfa";
import { listAllUserSessions } from "@/app/actions/sessions";
import MfaEnrollment from "./MfaEnrollment";
import UnenrollButton from "./UnenrollButton";
import SessionsPanel from "./SessionsPanel";
import { PageShell, Glass } from "@/components/ui/Glass";

export default async function SecuritySettingsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const { factors } = await listMfaFactors();
  const verifiedFactors = factors.filter((f) => f.status === "verified");
  const hasMfa = verifiedFactors.length > 0;
  const sessionsData = me.role === "owner" ? await listAllUserSessions() : { users: [] };

  return (
    <PageShell
      eyebrow="Settings"
      title="Security"
      subtitle={`Two-factor authentication for ${me.email}. Strongly recommended for owner + manager accounts handling claim data.`}
      action={
        <Link
          href="/settings"
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Settings
        </Link>
      }
      width="narrow"
    >
      {/* MFA status banner */}
      <div
        className={`border rounded-xl p-4 mb-6 ${
          hasMfa
            ? "bg-emerald-400/[0.06] border-emerald-400/30"
            : "bg-amber-400/[0.06] border-amber-400/30"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">{hasMfa ? "🔒" : "⚠️"}</span>
          <div>
            <p className={`font-semibold ${hasMfa ? "text-emerald-300" : "text-amber-300"}`}>
              {hasMfa
                ? "Two-factor authentication is on"
                : "Two-factor authentication is off"}
            </p>
            <p className="text-white/45 text-sm mt-0.5">
              {hasMfa
                ? "Login requires your password + a 6-digit code from your authenticator app."
                : "Anyone with your password can sign in. Add an authenticator below."}
            </p>
          </div>
        </div>
      </div>

      {/* Existing factors */}
      {factors.length > 0 && (
        <Glass className="p-5 mb-6">
          <h2 className="text-white/90 font-semibold mb-3">Active Authenticators</h2>
          <ul className="flex flex-col gap-2">
            {factors.map((f) => (
              <FactorRow key={f.id} factor={f} />
            ))}
          </ul>
        </Glass>
      )}

      {/* Enrollment */}
      <Glass className="p-5">
        <h2 className="text-white/90 font-semibold mb-1">Add an authenticator</h2>
        <p className="text-white/40 text-xs mb-4 leading-relaxed">
          Use Google Authenticator, 1Password, Authy, or any TOTP-compatible app.
          Scan the QR code, enter the 6-digit code to confirm. No SMS — SMS 2FA is
          vulnerable to SIM-swap attacks.
        </p>
        <MfaEnrollment />
      </Glass>

      {/* Sessions */}
      <SessionsPanel
        ownerView={me.role === "owner"}
        users={sessionsData.users}
        currentUserId={me.id}
      />

      {/* Footer guidance */}
      <Glass subtle className="mt-6 p-4 text-white/40 text-xs leading-relaxed">
        <p className="text-white/70 text-sm font-semibold mb-1">If you lose your authenticator</p>
        <p>
          You'll need an account recovery via the owner. Save your recovery codes
          (printed/secured) when you enroll, and consider enrolling a backup
          authenticator on a second device.
        </p>
      </Glass>
    </PageShell>
  );
}

function FactorRow({
  factor,
}: {
  factor: { id: string; type: string; friendlyName: string; status: string; createdAt: string };
}) {
  const statusColor =
    factor.status === "verified"
      ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20"
      : "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20";
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
      <div>
        <p className="text-white/90 text-sm">{factor.friendlyName}</p>
        <p className="text-white/40 text-xs">
          {factor.type.toUpperCase()} · added {new Date(factor.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
          {factor.status}
        </span>
        <UnenrollButton factorId={factor.id} />
      </div>
    </li>
  );
}
