import type { SVGProps } from "react";

export type NavIconName =
  | "home" | "jobs" | "schedule" | "customers" | "my-day"
  | "equipment" | "subs" | "documents" | "receivables" | "expenses"
  | "reports" | "calls" | "partners" | "settings" | "help";

const paths: Record<NavIconName, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7"/></>,
  jobs: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 11h18M10 11v2h4v-2"/></>,
  schedule: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3"/></>,
  customers: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  "my-day": <><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2M12 2v2M12 20v2M2 12h2M20 12h2"/></>,
  equipment: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 5V3h8v2M4 10h16M8 14h8M8 17h5"/></>,
  subs: <><path d="m8 12 3 3a2 2 0 0 0 3 0l5-5"/><path d="m16 8-2-2a2 2 0 0 0-3 0L5 12M2 10l4-4M18 6l4 4M7 14l-2 2M10 17l-2 2"/></>,
  documents: <><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h8"/></>,
  receivables: <><path d="M5 3h14v18l-2-1.5L15 21l-3-1.5L9 21l-2-1.5L5 21z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
  expenses: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 12h5M7 6V4h10v2M7 15h4"/></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  calls: <path d="M7.5 3H5a2 2 0 0 0-2 2c0 8.84 7.16 16 16 16a2 2 0 0 0 2-2v-2.5l-5-1-1.2 3a15.6 15.6 0 0 1-9.3-9.3l3-1.2z"/>,
  partners: <><circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 20v-2a5 5 0 0 1 10 0v2M12 20v-2a5 5 0 0 1 10 0v2"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.37.37.71.6 1 .27.3.62.45 1 .45h.09v4H21c-.4 0-.75.15-1 .45-.23.29-.44.63-.6 1.1Z"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.4 1-1.4 2.3M12 17h.01"/></>,
};

export function NavIcon({ name, ...props }: { name: NavIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths[name]}
    </svg>
  );
}

export function SignOutIcon(props: SVGProps<SVGSVGElement>) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></svg>;
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}><path d="m6 6 12 12M18 6 6 18"/></svg>;
}
