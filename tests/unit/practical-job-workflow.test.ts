import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");
const source = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("practical job workflow", () => {
  it("puts essential loss intake before optional administration", () => {
    const form = source("app/(dashboard)/jobs/new/NewJobForm.tsx");

    expect(form).toContain("Start with the customer and loss");
    expect(form).toContain("Phone or email is required");
    expect(form).toContain("Payment, insurance & referral");
    expect(form).toContain("<details");

    const address = source("components/AddressAutocomplete.tsx");
    expect(address).toContain('name="site_address"');
    expect(form).toContain("<AddressAutocomplete />");
    expect(form.indexOf("<AddressAutocomplete />")).toBeLessThan(
      form.indexOf('name="referred_by_id"')
    );
    expect(form.indexOf('name="type"')).toBeLessThan(
      form.indexOf('name="payment_route"')
    );
  });

  it("organizes the job around four plain-language work areas", () => {
    const page = source("app/(dashboard)/jobs/[id]/page.tsx");

    expect(page).toContain('title="Job setup"');
    expect(page).toContain('title="Field work"');
    expect(page).toContain('title="Billing & paperwork"');
    expect(page).toContain('title="More & history"');
    expect(page).toContain('const setupOpen = ["lead", "inspection"].includes(status);');
    expect(page).toContain(
      'const fieldOpen = ["mitigation", "drying", "reconstruction"].includes(status);'
    );
    expect(page).toContain('const moreOpen = status === "cancelled";');
    expect(page).toContain('id="act-paperwork"');
    expect(page).toContain("open={moreOpen}");

    expect(page.indexOf('title="Job setup"')).toBeLessThan(
      page.indexOf('title="Field work"')
    );
    expect(page.indexOf('title="Field work"')).toBeLessThan(
      page.indexOf('title="Billing & paperwork"')
    );
    expect(page.indexOf('title="Billing & paperwork"')).toBeLessThan(
      page.indexOf('title="More & history"')
    );
    expect(page.indexOf("<JobPnlCard")).toBeGreaterThan(
      page.indexOf('title="More & history"')
    );
    expect(page.indexOf("<CustomerShareCard")).toBeGreaterThan(
      page.indexOf('title="More & history"')
    );
    expect(page.indexOf("<JobActivityTimeline")).toBeGreaterThan(
      page.indexOf('title="More & history"')
    );

    const paperworkQueue = source("app/(dashboard)/documents/page.tsx");
    expect(paperworkQueue).not.toContain("#act-paperwork");
    expect(paperworkQueue).toContain("#paperwork");
  });

  it("uses task language instead of agent names in the practical job UI", () => {
    const checklist = source("app/(dashboard)/jobs/[id]/JobChecklist.tsx");
    const analyze = source("app/(dashboard)/jobs/[id]/AnalyzeButton.tsx");
    const dispatch = source("app/(dashboard)/jobs/[id]/DispatchInputs.tsx");
    const equipment = source("app/(dashboard)/jobs/[id]/JobEquipment.tsx");
    const documents = source("app/(dashboard)/jobs/[id]/EsquirePanel.tsx");
    const timeline = source("app/(dashboard)/jobs/[id]/JobActivityTimeline.tsx");

    expect(checklist).not.toContain("Argus needs");
    expect(checklist).not.toContain("from Esquire");
    expect(analyze).not.toContain("Analyze with Argus");
    expect(analyze).not.toContain("Argus analyzing");
    expect(dispatch).not.toContain("Not set — Argus");
    expect(equipment).not.toContain("Argus recommends");
    expect(timeline).not.toContain("Argus + Esquire");
    expect(timeline).not.toContain('actor: "Esquire"');
    expect(timeline).not.toContain("Esquire generated");
    expect(checklist).toContain("Analyze photos to create the working scope");
    expect(checklist).toContain("Create and send the Work Authorization");
    expect(analyze).toContain("Analyze photos");
    expect(dispatch).toContain("Property details");
    expect(dispatch).toContain("useState(false)");
    expect(equipment).toContain("Scope recommends");
    expect(documents).toContain("Create document");
  });
});
