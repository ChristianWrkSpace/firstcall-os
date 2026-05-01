// Catalog of every secret/API key the app holds.
// Used by /settings/secrets-rotation to render the rotation tracker.
// Update this list when a new vendor key is added to the env.

export interface SecretMeta {
  name: string;
  vendor: string;
  description: string;
  cadence_days: number;
  rotation_url: string;
  blast_radius: "low" | "medium" | "high";
}

export const SECRETS: SecretMeta[] = [
  {
    name: "ANTHROPIC_API_KEY",
    vendor: "Anthropic",
    description: "Claude API key for all AI agents (Athena/Argus/Ledger/Hunter/Esquire/Solomon).",
    cadence_days: 90,
    rotation_url: "https://console.anthropic.com/settings/keys",
    blast_radius: "high",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    vendor: "Supabase",
    description: "Server-side admin key. Bypasses RLS. Database/Storage write access.",
    cadence_days: 90,
    rotation_url: "https://supabase.com/dashboard/project/_/settings/api",
    blast_radius: "high",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    vendor: "Supabase",
    description: "Public anon key — RLS-bound. Rotation invalidates active sessions.",
    cadence_days: 180,
    rotation_url: "https://supabase.com/dashboard/project/_/settings/api",
    blast_radius: "medium",
  },
  {
    name: "STRIPE_SECRET_KEY",
    vendor: "Stripe",
    description: "Server-side payment + checkout. Live mode for real money.",
    cadence_days: 90,
    rotation_url: "https://dashboard.stripe.com/apikeys",
    blast_radius: "high",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    vendor: "Stripe",
    description: "Verifies webhook signatures. Rotate when endpoint URL changes.",
    cadence_days: 180,
    rotation_url: "https://dashboard.stripe.com/webhooks",
    blast_radius: "medium",
  },
  {
    name: "DEEPGRAM_API_KEY",
    vendor: "Deepgram",
    description: "Speech-to-text for Athena (call intake + conversation).",
    cadence_days: 90,
    rotation_url: "https://console.deepgram.com/keys",
    blast_radius: "medium",
  },
  {
    name: "ELEVENLABS_API_KEY",
    vendor: "ElevenLabs",
    description: "Text-to-speech for Athena's voice replies.",
    cadence_days: 90,
    rotation_url: "https://elevenlabs.io/app/settings/api-keys",
    blast_radius: "low",
  },
  {
    name: "RESEND_API_KEY",
    vendor: "Resend",
    description: "Transactional email — invoices, customer notifications, password resets.",
    cadence_days: 90,
    rotation_url: "https://resend.com/api-keys",
    blast_radius: "medium",
  },
  {
    name: "CRON_SECRET",
    vendor: "Vercel (self-issued)",
    description: "Bearer token Vercel Cron sends to /api/cron/* endpoints. Self-issued via openssl rand.",
    cadence_days: 180,
    rotation_url: "https://vercel.com/dashboard",
    blast_radius: "low",
  },
];
