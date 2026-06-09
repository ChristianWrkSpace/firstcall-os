# UI Audit: FirstCall OS — Current State

**Date:** June 8, 2026
**Stack:** Next.js 16.2.4 + React 19.2.4 + Tailwind v4 + Geist fonts
**Design System:** Industrial Glassmorphism (in-progress migration)

---

## 1. Component Library (`components/ui/`)

Only **one file** exists in the shared UI directory:

### `components/ui/Glass.tsx` — 4 exports

| Export | Signature | Pattern | Notes |
|--------|-----------|---------|-------|
| `Glass` | `({ children, className?, accent?, subtle? })` | Glass card with optional accent ring (neutral/teal/amber/blue) + shadow depth | Foundation surface primitive. Uses `bg-white/[0.03] backdrop-blur-2xl` |
| `PanelHeader` | `({ title, sub?, right?, emoji? })` | Section header with title + optional subtitle + right-side slot + emoji prefix | Duplicated in CommandCenterShell (worse: missing `emoji`) |
| `PageBackdrop` | `({ children })` | Full-page wrapper with `#0E1012` bg + radial gradient + SVG noise texture | Only used by My Day page |
| `CountChip` | `({ count, label, tone? })` | Small pill badge with count + label, 4 color tones | Used in CommandCenterShell |

### Other shared components (not under `ui/`)

| File | Export | Pattern |
|------|--------|---------|
| `components/Toast.tsx` | `ToastProvider`, `useToast` | Context-based toast system. 3 kinds: success/error/info. CSS `animate-toast-in` |
| `components/SectionHeader.tsx` | default | Expandable hint tooltip header. `size="sm"\|"md"` |
| `components/RoleGate.tsx` | `requireRoles`, `NoAccessPanel` | Server-side role guard + inline access-denied card |
| `components/Logo.tsx` | default + `LOGO_PUBLIC_URL` | Logo with `variant="banner"\|"mark"` |
| `components/AddressAutocomplete.tsx` | default | Photon API autocomplete, has its own internal `INPUT`/`LABEL` constants |
| `components/useToastForState.ts` | `useToastForState` | Bridge from `useActionState` to toasts |

### CRITICAL: Duplicated `Glass` component

**Location A:** `components/ui/Glass.tsx` — 4 accent options (neutral/teal/amber/blue), `PanelHeader` has `emoji` prop, `PageBackdrop` available.

**Location B:** `app/(dashboard)/command-center/CommandCenterShell.tsx` — re-implemented privately: only 3 accent options (no "blue"), `PanelHeader` missing `emoji` prop, has `PulseDot`/`CountChip`/`BackdropAtmosphere` (richer backdrop than PageBackdrop: animated drift layer + grain).

These two implementations have **diverged**. Changes to one won't affect the other.

---

## 2. Layout System

### Root Layout (`app/layout.tsx`)
- Geist Sans + Geist Mono via CSS variables (`--font-geist-sans`, `--font-geist-mono`)
- `ToastProvider` wrapping all children
- Vercel Analytics + SpeedInsights
- PWA metadata: `appleWebApp`, `viewport-fit: cover`, theme `#0a0a0a`
- Body: `min-h-full flex flex-col` with safe-area bottom padding

### Dashboard Layout (`app/(dashboard)/layout.tsx`)
- **Top-level:** `md:flex md:h-screen app-backdrop md:overflow-hidden`
- **Desktop sidebar:**
  - `w-56` fixed left panel, `bg-white/[0.02] backdrop-blur-2xl border-r border-white/[0.06]`
  - Brand (Logo + "FirstCall OS" subtext)
  - `SearchTrigger` button (opens CommandPalette via event)
  - `SidebarNav` — section-grouped nav with active-route highlight (teal dot indicator). Uses `usePathname()` client-side.
  - Role indicator + Sign out button
- **Mobile nav:** `MobileNav` — sticky top bar + slide-out drawer. Sections derived from same `NAV_SECTIONS`. Body scroll lock when open. iOS safe-area-aware.
- **Floating elements:**
  - Logo watermark (top-right, `pointer-events-none`)
  - `NotificationBell` (top-right, next to logo)
  - `CommandPalette` (global Cmd+K search modal)
  - `InstallPrompt` (PWA install nudge)

### Portal Layout (`app/portal/layout.tsx`)
- Minimal: `bg-zinc-950 text-white`, no sidebar, no app chrome
- Public route — token auth

### Adjuster Portal Layout (`app/adjuster/layout.tsx`)
- Identical minimal layout pattern to Portal

### Navigation Structure (`lib/nav.ts`)
7 workflow-grouped sections (Now → Work → Field → Money → Growth → Intelligence → System), role-filtered. Approx 24 nav items total. Icons are emoji strings.

---

## 3. Color Palette & Design Tokens

### New Glass System (Industrial Glassmorphism)

| Token | Value | Usage |
|-------|-------|-------|
| Foundation | `#0E1012` | Page backgrounds |
| Surface | `rgba(255,255,255,0.03)` with `backdrop-blur-2xl` | Card containers |
| Surface strong | `rgba(255,255,255,0.04)` with `backdrop-blur-2xl` | Prominent cards (`.glass-card-strong`) |
| Edge | `rgba(255,255,255,0.06)` | Hairline borders |
| Row hover | `rgba(255,255,255,0.02 → 0.04)` | Interactive rows |
| Healing Blue | `#6B8AD9` | Primary actions, blue accent |
| Safety Teal | `#5FBDB0` | Agent-active, processing, teal accent |
| Intervention | `#F59E0B` (amber-400) | Hand-offs, warnings |
| Body text | `rgba(255,255,255,0.92)` | Primary text |
| Muted text | `rgba(255,255,255,0.40)` | Secondary/meta text |
| Subtle text | `rgba(255,255,255,0.35)` | Tertiary/hints |

### Legacy Zinc System (still in heavy use)

| Token | Value | Found In |
|-------|-------|----------|
| `bg-zinc-950` | nearly black | Login, portal, adjuster, forgot-password, root homepage |
| `bg-zinc-900` | dark card | Login card, portal cards, CommandPalette, NoAccessPanel, ResetPassword, ForgotPassword |
| `bg-zinc-800` | input/darker | AddressAutocomplete, RoleGate buttons, various form inputs |
| `border-zinc-800` | border | Legacy cards |
| `border-zinc-700` | border (focus) | Input borders, CommandPalette |
| `text-zinc-400` | muted | Legacy body text |
| `text-zinc-500` | subtle | Legacy hint text |
| `text-zinc-200` | body | Legacy primary text |
| `text-zinc-300` | secondary | Labels |

### CSS Custom Properties (globals.css)
```css
:root {
  --background: #ffffff;
  --foreground: #171717;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}
```
These dark-mode `--background`/`--foreground` vars are set but largely **unused** — the app overrides them with `app-backdrop` or inline backgrounds everywhere.

### Theme Configuration (Tailwind v4)
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```
No custom color tokens in Tailwind config — all colors are inline hex/rgba in JSX `className` strings.

---

## 4. Key Pages & Layout Patterns

### Command Center (`/command-center`)
- **File:** `app/(dashboard)/command-center/CommandCenterShell.tsx`
- **Pattern:** Full custom shell — zero dependencies, self-contained with inline SVGs + `<style jsx global>` keyframes. 12-col bento grid. Multimodal Echo command bar. Agent workflow cards, hand-off stack, today metrics, compute panel, job pulse.
- **Backdrop:** Ambient radial gradients + animated drift + SVG noise grain (richer than `PageBackdrop`)
- **Design:** Fully glassmorphism, all tokens consistent

### My Day (`/my-day`)
- **File:** `app/(dashboard)/my-day/page.tsx`
- **Pattern:** `PageBackdrop` wrapper → date-bucketed job cards. Each card: `Glass subtle` + job info + 3 quick-action buttons (Navigate/Maps, Call, Open) with 48px min tap targets.
- **Design:** Fully glass— uses `GLASS_STATUS` palette (softer than `STATUS_COLORS`)

### Jobs List (`/jobs`)
- **File:** `app/(dashboard)/jobs/page.tsx`
- **Pattern:** Page header + tab bar (active/completed/cancelled/all) + `glass-card` wrapped table
- **Design:** Mixed — top section uses glass-card, table is legacy table styling

### Job Detail (`/jobs/[id]`)
- **File:** `app/(dashboard)/jobs/[id]/page.tsx` (692 lines)
- **Pattern:** Two-column layout: main content (2/3) with sticky top nav, right sidebar (1/3) with stacked cards. Each section: `glass-card p-6` + `SectionHeader`. ~25 sub-components (PhotoUploader, VoiceNote, StatusSelector, EsquirePanel, etc.)
- **Design:** Mostly glass-card. Right column uses `glass-card p-6` consistently. Some legacy `bg-zinc-800` patterns in internal sub-components.

### Settings (`/settings`)
- **File:** `app/(dashboard)/settings/page.tsx`
- **Pattern:** Grid of emoji cards. Each card: `glass-card p-5 hover:border-zinc-700`. Role-filtered visibility.
- **Design:** Glass (good)

### AR Dashboard, Approvals, Progress, Customers
- **Pattern:** Header + `glass-card` wrapper + tables. Some have legacy zinc accents (draft callout `bg-blue-500/5`). Tables all share the same markup pattern (head tr with `border-b border-white/[0.06] text-zinc-500`, rows with hover `bg-white/[0.04]`).

### Login, Forgot Password, Reset Password
- **Pattern:** Centered `bg-zinc-900 border-zinc-800 rounded-2xl` card. Inputs: `bg-zinc-800 border-zinc-700`.
- **Design:** **Fully legacy zinc** — no glass tokens whatsoever

### Portal, Adjuster Portal
- **Pattern:** Minimal `bg-zinc-950` layout. Cards use `bg-zinc-900 border-zinc-800`.
- **Design:** **Fully legacy zinc**

### Root Homepage (`/`)
- **Pattern:** Next.js default boilerplate — `bg-zinc-50` light / `dark:bg-black` dark, Vercel/Next.js template content
- **Debt:** Placeholder page, should redirect or serve a landing page

---

## 5. Animation & Motion Patterns

No framer-motion dependency. All animations are CSS keyframes.

| Animation | Definition | Usage |
|-----------|-----------|-------|
| `toast-in` | `translateY(8px) scale(0.97)` → normal, 180ms | Toasts (globals.css) |
| `rise-in` | `translateY(6px) scale(0.985)` → normal, 420ms | Workflow rows, handoff cards, job pulse cards (CommandCenter) |
| `ping-slow` | scale 1→1.6 with opacity 0.55→0, 1.8s infinite | System pulse dot (CommandCenter) |
| `pulse-soft` | opacity 0.20↔0.55, 3.2s infinite | Active workflow ring glow (CommandCenter) |
| `pulse-amber` | opacity 0.25↔0.65, 3.6s infinite | Handoff card amber ring (CommandCenter) |
| `shimmer-bg` | background-position sweep, 2.4s infinite | Active progress bars (CommandCenter) |
| `shimmer-border` | box-shadow pulse, 1.6s infinite | Drag-over command bar (CommandCenter) |
| `drift` | 2% translate + scale 1.05, 18s infinite | Background atmosphere (CommandCenter) |

All animations except `toast-in` are self-mounted via `<style jsx global>` inside `CommandCenterShell.tsx`. They are only available on the command center page — **not globally reusable**.

---

## 6. Typography System

- **Primary:** Geist Sans (via `var(--font-geist-sans)`)
- **Monospace:** Geist Mono (via `var(--font-geist-mono)`)
- **Size scale observed:**
  - `text-[9px]` — section headers in nav, tiny labels
  - `text-[10px]` — uppercase tracking labels, sidebar hints, CountChip
  - `text-[11px]` — subtext, secondary info
  - `text-xs` — metadata, timestamps
  - `text-sm` — UI labels, button text, nav items, table content
  - `text-base` — body text, job cards
  - `text-lg` / `text-xl` — headings
  - `text-2xl` — page titles
  - `text-3xl`–`text-5xl` — hero/kpi numbers
- **Tracking patterns:** `tracking-[0.18em]` or `tracking-[0.2em]` for uppercase labels; `tracking-tight` for headings; `tracking-wide` for status pills
- **Consistent patterns:**
  - Page titles: `text-2xl font-bold text-white`
  - Section headers: `text-sm font-semibold tracking-tight text-white/95`
  - Muted subtext: `text-zinc-400 text-sm mt-0.5` or `text-white/45 text-sm mt-1`

---

## 7. Responsive Patterns

| Pattern | Implementation |
|---------|---------------|
| Desktop/Mobile split | `md:` breakpoint. `hidden md:flex` for desktop-only, `md:hidden` for mobile-only |
| Sidebar | Desktop: fixed `w-56`; Mobile: full-width slide-out drawer with overlay |
| Bento grid | `grid-cols-1 md:grid-cols-12` — collapses to single column, can span 4/8/12 |
| Card grids | `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` |
| Tables | `overflow-x-auto` wrappers |
| Safe areas (PWA) | `padding-top: calc(0.75rem + env(safe-area-inset-top))` on mobile header; `padding-bottom: env(safe-area-inset-bottom)` on body |
| Touch targets | 48px minimum (My Day quick-action buttons explicitly `min-h-[48px]`) |
| Viewport | `maximumScale: 5` (accessibility), `viewportFit: cover` |
| PWA manifest | Shortcuts for My Day, New Call, Approvals |

---

## 8. Design Debt & Inconsistencies

### A. Duplicated Glass Implementation (HIGH)
- `components/ui/Glass.tsx` and `CommandCenterShell.tsx` have **two different `Glass` components** with different feature sets. The shell version is the "richer" one (better backdrop, `PulseDot`) but missing `blue` accent. Any change to Glass requires updating both files. The shell version also has a worse `PanelHeader` (no `emoji`).

### B. Incomplete Glass Migration (HIGH)
Only ~40% of pages use the new glass design tokens:
- **Glass:** Command Center, My Day, Settings, Jobs, AR, Progress, Approvals (partial)
- **Legacy Zinc:** Login, Forgot Password, Reset Password, Portal, Adjuster Portal, CommandPalette, NoAccessPanel, many sub-components

The CSS classes `.glass-card`, `.glass-card-strong`, `.glass-row` exist in `globals.css` but are only referenced in ~6 pages.

### C. No Shared Form Elements (HIGH)
Every page defines its own input/label/button styling inline. `AddressAutocomplete` has constants (`INPUT`, `LABEL`) that should be shared components. Login, forgot-password, reset-password all copy-paste the same input styles.

### D. Two Status Color Palettes
- `STATUS_COLORS` in `lib/constants.ts` — high-opacity: `bg-blue-500/20 text-blue-400`
- `GLASS_STATUS` in `my-day/page.tsx` — glass-tuned: `bg-[#6B8AD9]/15 text-[#A6B8E7] ring-[#6B8AD9]/25`
- Job detail sub-components (Estimates, Invoices, Photos) use yet another inline status palette

### E. Two Header Components (MEDIUM)
- `SectionHeader` (`components/SectionHeader.tsx`) — has expandable `hint` tooltip, `emoji`, `size` prop. Uses legacy `text-zinc-500` colors.
- `PanelHeader` (`components/ui/Glass.tsx` and duplicated in CommandCenterShell) — has `title`, `sub`, `right`, sometimes `emoji`. Uses glass `text-white/95` colors.
- These serve the same purpose with different APIs and color schemes.

### F. No Shared Table Component (MEDIUM)
5+ pages repeat the same table markup pattern (Jobs, Customers, AR, Approvals, Activity). Identical: `<thead>` with `border-b border-white/[0.06] text-zinc-500 text-xs uppercase tracking-wide`, `<tbody>` with `hover:bg-white/[0.04]`.

### G. No Shared Button Component (MEDIUM)
Every button is inline Tailwind. Common patterns:
- Primary: `bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg`
- Glass button: `bg-white/[0.04] hover:bg-white/[0.08] text-white/85 border-white/[0.06]`
- Ghost: `text-zinc-400 hover:text-white`

### H. CommandPalette Uses Legacy Zinc (LOW)
`bg-zinc-900 border-zinc-700` — not glass. Should match the new design system.

### I. Glow/PageBackdrop Inconsistency (LOW)
- `PageBackdrop` (Glass.tsx): static radial gradients + noise, opacity 0.60
- `BackdropAtmosphere` (CommandCenterShell): same gradients but opacity 0.60, PLUS animated drift layer (opacity 0.40) and noise (opacity 0.025)
- My Day uses `PageBackdrop`, Command Center uses its own richer version

### J. Rounded Corner Inconsistency (LOW)
Glass components use `rounded-2xl`. CSS classes use `rounded-xl`. Login card uses `rounded-2xl`. The intent is `rounded-2xl` for cards, but many pages/classes use `rounded-xl` or `rounded-lg` for internal elements.

### K. Blueprint Homepage (LOW)
`app/page.tsx` is still Next.js's default boilerplate with Vercel template content. Should redirect to `/login` or `/command-center`.

### L. Color Token Scattered Definition (LOW)
Design colors like `#6B8AD9`, `#5FBDB0`, `#F59E0B` are repeated as inline strings across 20+ files. No CSS custom properties or Tailwind v4 `@theme` tokens for these semantic colors.

### M. `app-backdrop` CSS Class Barely Used
Defined in globals.css with `#0E1012` + radial gradients, but only the dashboard layout uses it. The Command Center duplicates it inline. Individual pages use `PageBackdrop` component instead.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total `.tsx` files | ~200+ |
| Shared UI components (`components/ui/`) | 1 file, 4 exports |
| Other shared components | 6 files |
| Pages/routes | ~50 |
| Design token color values in code | 3 (surface + edge + text), rest inline |
| CSS utility classes | 3 (`.glass-card`, `.glass-card-strong`, `.glass-row`) |
| CSS keyframe animations | 8 (1 global, 7 shell-only) |
| Status color palettes in use | 3+ (contradictory) |
| Button style variants (no shared component) | 5+ distinct inline patterns |
| Input style variants (no shared component) | 3+ distinct inline patterns |
| Pages fully migrated to Glass | ~40% |
| Pages using legacy Zinc | ~60% |
