// Branded customer-facing email templates for First Call Mitigation.

export type NotificationEvent =
  | "dispatched"
  | "mitigation_started"
  | "drying_started"
  | "equipment_check"
  | "work_completed"
  | "follow_up"
  | "custom";

export const EVENT_META: Record<
  NotificationEvent,
  { label: string; description: string; emoji: string }
> = {
  dispatched: {
    label: "Tech Dispatched",
    description: "Tech is on the way. ETA + reassurance.",
    emoji: "🚐",
  },
  mitigation_started: {
    label: "Mitigation Started",
    description: "Confirmation that on-site work has begun.",
    emoji: "🔧",
  },
  drying_started: {
    label: "Drying Phase Started",
    description: "Equipment placed, daily monitoring begins.",
    emoji: "💨",
  },
  equipment_check: {
    label: "Daily Moisture Check",
    description: "Confirms tech visited and checked readings today.",
    emoji: "📋",
  },
  work_completed: {
    label: "Work Complete",
    description: "Equipment removed, mitigation finished.",
    emoji: "✅",
  },
  follow_up: {
    label: "Follow-Up",
    description: "Day-after check-in to make sure everything's good.",
    emoji: "👋",
  },
  custom: {
    label: "Custom Message",
    description: "Write your own message to the customer.",
    emoji: "✍️",
  },
};

interface CtxBase {
  customer_name: string;
  job_number: string;
  site_address?: string | null;
}

// Absolute URL — emails are rendered in clients (Gmail, Outlook) that can't
// resolve relative paths. PNG used here because some email clients don't render SVG.
const EMAIL_LOGO_URL = "https://firstcall-os.vercel.app/logo-banner.png";

// Where the customer lands when they click "Leave us a Google review" in
// post-job emails. Override via GOOGLE_REVIEW_URL env var when you have the
// canonical writereview link with the business's placeid (gets you straight
// to the star-rating modal). Defaults to a search URL that surfaces the
// business panel — works without a placeid but adds one click.
const REVIEW_URL =
  process.env.GOOGLE_REVIEW_URL ??
  "https://www.google.com/search?q=First+Call+Mitigation+Austin+TX+reviews";

function shell(body: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px 16px 28px;border-bottom:2px solid #2563eb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <img src="${EMAIL_LOGO_URL}" alt="First Call Mitigation" height="40" style="display:block;height:40px;width:auto;border:0;outline:none;text-decoration:none;">
              </td>
              <td align="right" style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:1px;vertical-align:middle;">Water · Fire · Mold</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 28px;line-height:1.6;color:#27272a;">${body}</td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7;background:#fafafa;font-size:11px;color:#71717a;">
          First Call Mitigation · Austin, TX · IICRC Certified · 24/7 Emergency Response<br>
          Reply to this email anytime — our office responds within one business day.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function jobTag(ctx: CtxBase) {
  return `
    <p style="margin:18px 0 0 0;font-size:11px;color:#a1a1aa;border-top:1px solid #e4e4e7;padding-top:12px;">
      Job <span style="font-family:Menlo,monospace;">${ctx.job_number}</span>${ctx.site_address ? ` · ${ctx.site_address}` : ""}
    </p>`;
}

export function buildNotificationEmail(
  event: NotificationEvent,
  ctx: CtxBase,
  customMessage?: string
): { subject: string; html: string } {
  const firstName = ctx.customer_name.split(" ")[0] ?? ctx.customer_name;

  switch (event) {
    case "dispatched":
      return {
        subject: `We're on the way — Job ${ctx.job_number}`,
        html: shell(`
          <h2 style="margin:0 0 12px 0;color:#18181b;">Hi ${firstName} — we're heading your way.</h2>
          <p>Our technician is on the road to <strong>${ctx.site_address ?? "your property"}</strong> right now. They'll call you when they're about 10 minutes out so you know to expect them.</p>
          <p>If you have to step out for any reason or there's a gate/access code we should know about, just reply to this email and we'll get word to the tech.</p>
          <p>Hang in there — we'll have eyes on this shortly.</p>
          ${jobTag(ctx)}
        `),
      };

    case "mitigation_started":
      return {
        subject: `Mitigation work has started at your property`,
        html: shell(`
          <h2 style="margin:0 0 12px 0;">Mitigation has begun, ${firstName}.</h2>
          <p>Our crew is on site and has started the mitigation work — extracting standing water, removing affected materials per IICRC S500 standards, and prepping the area for the drying phase.</p>
          <p>You may notice equipment being staged and some controlled demolition (e.g., flood cuts, baseboards) — this is normal and necessary to prevent secondary damage.</p>
          <p>The lead tech will walk you through what's happening when they leave today.</p>
          ${jobTag(ctx)}
        `),
      };

    case "drying_started":
      return {
        subject: `Drying phase started — equipment is now running`,
        html: shell(`
          <h2 style="margin:0 0 12px 0;">Drying is underway.</h2>
          <p>The dehumidifiers and air movers are now running at your property. Please leave them on — interrupting the drying cycle can extend timelines and cause secondary issues.</p>
          <p><strong>Typical drying time is 3–5 days.</strong> A tech will visit each day to take moisture readings and adjust equipment as needed.</p>
          <p>Couple things to know:</p>
          <ul style="padding-left:20px;">
            <li>The equipment is loud — that's normal.</li>
            <li>Doors should stay closed in the affected rooms.</li>
            <li>The room may feel warmer than usual — also normal.</li>
            <li>Don't unplug anything. If it trips a breaker, call us immediately.</li>
          </ul>
          ${jobTag(ctx)}
        `),
      };

    case "equipment_check":
      return {
        subject: `Daily moisture check — Job ${ctx.job_number}`,
        html: shell(`
          <h2 style="margin:0 0 12px 0;">Quick update.</h2>
          <p>Our tech stopped by today and took moisture readings. The equipment is running as expected and the materials are drying on schedule.</p>
          <p>We'll be back tomorrow for the next reading. If anything changes — equipment goes quiet, you smell something off, you spot new water — call us right away.</p>
          ${jobTag(ctx)}
        `),
      };

    case "work_completed":
      return {
        subject: `Work complete — equipment has been removed`,
        html: shell(`
          <h2 style="margin:0 0 12px 0;">All done, ${firstName}.</h2>
          <p>Final moisture readings confirm your property is dry to IICRC standards. The crew has removed all equipment and cleaned up the work area.</p>
          <p>You should receive a final report and a copy of the invoice in the next 24 hours. If your insurance carrier needs anything from us directly, we'll handle that — just let us know who your adjuster is if you haven't already.</p>
          <p>Thanks for trusting us with the work. We know this isn't the situation you wanted to be in, and we're glad we could help get things back to normal.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px 0;">
            <tr><td>
              <a href="${REVIEW_URL}" style="display:inline-block;padding:12px 22px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;border-radius:6px;font-size:14px;">⭐ Leave us a Google review</a>
            </td></tr>
          </table>
          <p style="font-size:13px;color:#52525b;">If you were happy with our work, a quick review on Google means the world to a small business like ours — it's the single biggest thing that helps the next neighbor find us in an emergency. Takes 30 seconds.</p>
          ${jobTag(ctx)}
        `),
      };

    case "follow_up":
      return {
        subject: `Checking in — how's everything looking?`,
        html: shell(`
          <h2 style="margin:0 0 12px 0;">Quick check-in, ${firstName}.</h2>
          <p>It's been a few days since we wrapped up. Just wanted to make sure everything is still dry and the property is back to feeling like home.</p>
          <p>If you've noticed anything — musty smells, soft spots in the floor, paint discoloration — reply to this email and we'll come take a look at no charge.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 8px 0;">
            <tr><td>
              <a href="${REVIEW_URL}" style="display:inline-block;padding:12px 22px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;border-radius:6px;font-size:14px;">⭐ Leave us a Google review</a>
            </td></tr>
          </table>
          <p style="font-size:13px;color:#52525b;">If you were happy with the work, a quick review helps the next neighbor find us in an emergency. Takes 30 seconds.</p>
          ${jobTag(ctx)}
        `),
      };

    case "custom": {
      const body = customMessage?.trim() ?? "";
      return {
        subject: `Update on your job — ${ctx.job_number}`,
        html: shell(`
          <h2 style="margin:0 0 12px 0;">Hi ${firstName},</h2>
          ${body
            .split(/\n\n+/)
            .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
            .join("")}
          ${jobTag(ctx)}
        `),
      };
    }
  }
}
