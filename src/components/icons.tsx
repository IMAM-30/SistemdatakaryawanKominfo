import type { SVGProps } from "react";

export type IconName = "home" | "people" | "accounts" | "fields" | "audit" | "settings" | "sun" | "moon" | "clock" | "search" | "menu" | "close" | "logout" | "plus" | "edit" | "eye" | "trash" | "restore" | "download" | "chevron" | "check" | "alert" | "lock" | "user" | "activity" | "database" | "filter" | "more";

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  accounts: <><circle cx="12" cy="8" r="4"/><path d="M5.4 21a7 7 0 0 1 13.2 0"/><path d="M19 8h4M21 6v4"/></>,
  fields: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  audit: <><path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/><path d="m9 15 3 3L22 8"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.37.33.7.6 1 .28.27.63.48 1 .6h.09v4H21c-.37.12-.72.33-1 .6-.27.28-.48.63-.6 1Z"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>, close: <path d="M5 5l14 14M19 5 5 19"/>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>, edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/></>,
  restore: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></>, chevron: <path d="m9 18 6-6-6-6"/>,
  check: <path d="m5 12 4 4L19 6"/>, alert: <><path d="M12 3 2 21h20Z"/><path d="M12 9v4M12 17h.01"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  activity: <path d="M3 12h4l2-7 4 14 2-7h6"/>, database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8Z"/>, more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
};

export function Icon({ name, size = 20, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
