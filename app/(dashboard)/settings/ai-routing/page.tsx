import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { describeRouting } from "@/lib/agent-models";
import { AI_PROVIDER, MODELS } from "@/lib/ai";
import { PageShell, Glass } from "@/components/ui/Glass";

export default async function AiRoutingPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") redirect("/settings");

  const routing = describeRouting();

  return (
    <PageShell
      eyebrow="Settings"
      title="AI Routing"
      subtitle="Per-agent model overrides and cross-provider fallback chains. The system always tries the agent's primary model first; if it fails with a retryable error (timeout / 5xx / rate-limit), the wrapper automatically retries on the next provider in the chain."
      action={
        <Link
          href="/settings"
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Settings
        </Link>
      }
      width="wide"
    >
      <Glass className="p-5 mb-5">
        <p className="text-white/40 text-xs uppercase tracking-wide mb-3">Gateway status</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field
            label="Provider mode"
            value={AI_PROVIDER}
            tone={AI_PROVIDER === "gateway" ? "good" : "warn"}
          />
          <Field label="Default FAST" value={MODELS.FAST} />
          <Field label="Default BALANCED" value={MODELS.BALANCED} />
          <Field label="Default SMART" value={MODELS.SMART} />
        </div>
        {AI_PROVIDER !== "gateway" && (
          <p className="mt-3 text-amber-300 text-xs">
            ⚠ Direct Anthropic mode — cross-provider fallback is disabled
            (the SDK client is pointed at api.anthropic.com). Set{" "}
            <code className="bg-amber-400/10 px-1 rounded">AI_GATEWAY_ENABLED=true</code>{" "}
            in Vercel env to enable.
          </p>
        )}
      </Glass>

      <Glass className="p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white/90 font-semibold">Per-Agent Model Overrides</h2>
          <span className="text-white/40 text-xs">
            {routing.perAgentOverrides.length} active
          </span>
        </div>
        {routing.perAgentOverrides.length === 0 ? (
          <p className="text-white/45 text-sm">
            No agents are currently overridden. Every agent uses its declared
            default tier (Haiku / Sonnet / Opus). To swap an agent onto a
            cheaper provider, set a Vercel env var:
          </p>
        ) : (
          <table className="w-full text-sm mb-3">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-wide">
                <th className="text-left py-2">Agent</th>
                <th className="text-left py-2">Routed to</th>
                <th className="text-left py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {routing.perAgentOverrides.map((o) => (
                <tr key={o.agent} className="border-t border-white/[0.06]">
                  <td className="py-2 text-white/80 capitalize">{o.agent}</td>
                  <td className="py-2 font-mono text-[#A6B8E7] text-xs">{o.model}</td>
                  <td className="py-2">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${
                        o.from === "env"
                          ? "bg-[#6B8AD9]/15 text-[#A6B8E7] border-[#6B8AD9]/20"
                          : "bg-purple-400/15 text-purple-300 border-purple-400/20"
                      }`}
                    >
                      {o.from === "env" ? "env var" : "static"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Glass accent="blue" subtle className="p-4">
          <p className="text-[#A6B8E7] font-semibold text-sm mb-2">
            How to override an agent (no redeploy required)
          </p>
          <p className="text-white/70 text-xs mb-2">
            In Vercel project settings → Environment Variables, set:
          </p>
          <div className="font-mono text-xs space-y-1 text-white/80 bg-black/25 ring-1 ring-white/[0.06] rounded p-3">
            <div>
              <span className="text-white/35"># Examples — pick what fits your traffic</span>
            </div>
            <div>MODEL_HUNTER=deepseek/deepseek-v3</div>
            <div>MODEL_ECHO=google/gemini-2.5-flash</div>
            <div>MODEL_EXTRACT=deepseek/deepseek-v3</div>
          </div>
          <p className="text-white/45 text-xs mt-2">
            After saving, redeploy or restart. Delete the env var to revert.
          </p>
        </Glass>
      </Glass>

      <Glass className="p-5 mb-5">
        <h2 className="text-white/90 font-semibold mb-3">Fallback Chains</h2>
        <p className="text-white/45 text-xs mb-3">
          When a model fails with a retryable error, the wrapper retries on
          the next entry. Cross-provider fallbacks of similar capability —
          a timeout on Sonnet falls to Gemini 2.5 Pro, not Haiku.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/40 text-xs uppercase tracking-wide">
              <th className="text-left py-2 w-1/3">Primary</th>
              <th className="text-left py-2">Falls back to (in order)</th>
            </tr>
          </thead>
          <tbody>
            {routing.fallbackChains.map((fc) => (
              <tr key={fc.model} className="border-t border-white/[0.06]">
                <td className="py-2 font-mono text-white/80 text-xs">{fc.model}</td>
                <td className="py-2 font-mono text-[#A6B8E7] text-xs">{fc.chain.join(" → ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Glass>

      <Glass subtle className="p-5">
        <h2 className="text-white/90 font-semibold mb-2 text-sm">
          What gets logged on a fallback
        </h2>
        <ul className="text-white/70 text-xs space-y-1 list-disc pl-5">
          <li>
            The failed primary attempt logs as an error row in{" "}
            <code className="text-white/80">agent_invocations</code> with
            the original error message.
          </li>
          <li>
            The succeeded fallback logs as a success row with{" "}
            <code className="text-white/80">error = &quot;fallback_used: primary=...&quot;</code>{" "}
            so dashboards can flag fallback frequency.
          </li>
          <li>
            The agent doing the work never sees the fallback — it gets back
            a normal Anthropic-shaped response either way.
          </li>
        </ul>
      </Glass>
    </PageShell>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  const cls =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
      ? "text-amber-300"
      : "text-white/80";
  return (
    <div>
      <p className="text-white/40 text-xs uppercase tracking-wide">{label}</p>
      <p className={`font-mono text-sm mt-0.5 ${cls}`}>{value}</p>
    </div>
  );
}
