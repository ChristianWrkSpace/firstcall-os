import { anthropic, MODELS } from "./ai";
import { BUSINESS_TYPES, type BusinessType } from "./hunter-types";

// Re-export for convenience so existing server-side imports keep working.
export { BUSINESS_TYPES, type BusinessType };

interface LeadContext {
  company_name: string;
  contact_name?: string | null;
  contact_title?: string | null;
  business_type: BusinessType;
  city?: string | null;
  notes?: string | null;
}

export async function generateColdEmail(lead: LeadContext) {
  const meta = BUSINESS_TYPES[lead.business_type];
  const message = await anthropic.messages.create({
    model: MODELS.FAST,
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `You are Hunter, the B2B sales drafter for First Call Mitigation — an Austin TX water/fire/mold restoration company. IICRC-certified, 24/7 emergency, insurance-direct billing, founded by Christian Castro.

Draft a SHORT, personalized cold email to a ${meta.label}. The angle: ${meta.pitch}

Lead context:
- Company: ${lead.company_name}
${lead.contact_name ? `- Contact: ${lead.contact_name}${lead.contact_title ? ` (${lead.contact_title})` : ""}` : ""}
- City: ${lead.city ?? "Austin"}
${lead.notes ? `- Notes: ${lead.notes}` : ""}

REQUIREMENTS:
- Under 130 words in the body
- Subject line under 60 chars, no "Re:" or fake urgency
- One concrete value angle, not a feature list
- Soft CTA: 15-min call OR reply if interested in being on the preferred-vendor list
- Reference Austin / local where natural
- No emojis, no "I hope this finds you well", no "I came across your business"

Respond ONLY with this exact format (no other text):
SUBJECT: <subject line>
BODY:
<email body>`,
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)$/i);

  return {
    subject: subjectMatch?.[1]?.trim() ?? `Quick intro from First Call Mitigation`,
    body: bodyMatch?.[1]?.trim() ?? text.trim(),
  };
}

export async function generateVoicemailScript(lead: LeadContext) {
  const meta = BUSINESS_TYPES[lead.business_type];
  const message = await anthropic.messages.create({
    model: MODELS.FAST,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `You are Hunter for First Call Mitigation in Austin TX. Draft a 30-second voicemail script for a cold call to a ${meta.label}.

Company: ${lead.company_name}
${lead.contact_name ? `Asking for: ${lead.contact_name}` : ""}
Angle: ${meta.pitch}

REQUIREMENTS:
- Under 70 words spoken (≈30 seconds)
- Natural, conversational — written for ear not eye
- One sentence value prop
- Clear callback ask at the end with a friendly tone
- No corporate filler

Respond ONLY with the script text, nothing else.`,
      },
    ],
  });
  return message.content
    .filter((b) => b.type === "text")
    .map((b: any) => b.text)
    .join("")
    .trim();
}

export async function generateFollowUpEmail(
  lead: LeadContext,
  previousMessage: string
) {
  const message = await anthropic.messages.create({
    model: MODELS.FAST,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are Hunter for First Call Mitigation in Austin TX. Draft a SHORT follow-up email referencing the previous touch.

Company: ${lead.company_name}
${lead.contact_name ? `Contact: ${lead.contact_name}` : ""}

Previous message we sent:
${previousMessage}

REQUIREMENTS:
- Under 80 words
- Reference the prior reach naturally ("Wanted to circle back...")
- One new angle or proof point
- Soft CTA — give them an easy out ("If now's not the time, no worries")
- No guilt-trip language

Respond ONLY with this exact format:
SUBJECT: <subject>
BODY:
<body>`,
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)$/i);

  return {
    subject: subjectMatch?.[1]?.trim() ?? `Following up`,
    body: bodyMatch?.[1]?.trim() ?? text.trim(),
  };
}
