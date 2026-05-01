import { createServerSupabaseClient } from "@/lib/supabase-server";
import NewJobForm, { type PartnerOption } from "./NewJobForm";

export default async function NewJobPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("partners")
    .select("id, name, company, partner_type, active")
    .eq("active", true)
    .order("name", { ascending: true });

  const partners: PartnerOption[] = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    company: p.company ?? null,
    partner_type: p.partner_type ?? null,
  }));

  return <NewJobForm partners={partners} />;
}
