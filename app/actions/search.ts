"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface SearchResult {
  id: string;
  type: "job" | "customer" | "equipment" | "partner" | "outreach" | "call";
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
  emoji: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = await createServerSupabaseClient();
  const like = `%${q}%`;

  const [
    { data: jobs },
    { data: customers },
    { data: equipment },
    { data: partners },
    { data: leads },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_number, status, type, site_address, site_city, customers(name)")
      .or(`job_number.ilike.${like},site_address.ilike.${like},description.ilike.${like}`)
      .limit(10),
    supabase
      .from("customers")
      .select("id, name, email, phone, insurance_company, insurance_claim_number")
      .or(
        `name.ilike.${like},email.ilike.${like},phone.ilike.${like},insurance_company.ilike.${like},insurance_claim_number.ilike.${like}`
      )
      .limit(10),
    supabase
      .from("equipment")
      .select("id, type, serial_number, model, manufacturer, status")
      .or(`serial_number.ilike.${like},model.ilike.${like},manufacturer.ilike.${like}`)
      .limit(10),
    supabase
      .from("partners")
      .select("id, name, company, phone, email")
      .or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(10),
    supabase
      .from("outreach_leads")
      .select("id, company_name, contact_name, contact_email, business_type, status")
      .or(
        `company_name.ilike.${like},contact_name.ilike.${like},contact_email.ilike.${like}`
      )
      .limit(10),
  ]);

  const results: SearchResult[] = [];

  for (const j of jobs ?? []) {
    results.push({
      id: j.id,
      type: "job",
      title: j.job_number,
      subtitle: (j.customers as any)?.name ?? "—",
      meta:
        [j.site_address, j.site_city].filter(Boolean).join(", ") ||
        `${j.type} · ${j.status}`,
      href: `/jobs/${j.id}`,
      emoji: "◈",
    });
  }

  for (const c of customers ?? []) {
    results.push({
      id: c.id,
      type: "customer",
      title: c.name,
      subtitle: [c.email, c.phone].filter(Boolean).join(" · ") || "no contact",
      meta: c.insurance_company
        ? `${c.insurance_company}${c.insurance_claim_number ? ` · ${c.insurance_claim_number}` : ""}`
        : undefined,
      href: `/customers`,
      emoji: "◉",
    });
  }

  for (const e of equipment ?? []) {
    results.push({
      id: e.id,
      type: "equipment",
      title: e.serial_number,
      subtitle: [e.manufacturer, e.model].filter(Boolean).join(" ") || e.type,
      meta: e.status,
      href: `/equipment/${e.id}`,
      emoji: "▤",
    });
  }

  for (const p of partners ?? []) {
    results.push({
      id: p.id,
      type: "partner",
      title: p.name,
      subtitle: p.company ?? p.email ?? p.phone ?? "—",
      href: `/partners`,
      emoji: "◐",
    });
  }

  for (const l of leads ?? []) {
    results.push({
      id: l.id,
      type: "outreach",
      title: l.company_name,
      subtitle: l.contact_name ?? l.contact_email ?? l.business_type,
      meta: l.status,
      href: `/partners/outreach/${l.id}`,
      emoji: "🎯",
    });
  }

  return results;
}
