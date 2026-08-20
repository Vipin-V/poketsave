import { Link, useRouterState } from "@tanstack/react-router";
import { Bookmark, Briefcase, CalendarDays, Plus, Star, Users } from "lucide-react";
import type { ReactNode } from "react";
import { AccountButton } from "./AccountButton";

const TABS = [
  { to: "/", icon: Bookmark, label: "Library", match: (p: string) => p === "/" },
  { to: "/albums", icon: Users, label: "Albums", match: (p: string) => p.startsWith("/albums") },
  { to: "/favorites", icon: Star, label: "Saved", match: (p: string) => p.startsWith("/favorites") },
  { to: "/jobs", icon: Briefcase, label: "Jobs", match: (p: string) => p.startsWith("/jobs") },
  {
    to: "/calendar",
    icon: CalendarDays,
    label: "Calendar",
    match: (p: string) => p.startsWith("/calendar"),
  },
] as const;

export function PhoneShell({ children, onAdd }: { children: ReactNode; onAdd: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const left = TABS.slice(0, 2);
  const right = TABS.slice(3);
  const saved = TABS[2];
  const SavedIcon = saved.icon;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col">
      <main
        className="flex-1 px-4 pb-40"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <Link
            to="/favorites"
            aria-label="Saved"
            className={`glass grid size-11 place-items-center rounded-full ${
              saved.match(pathname) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <SavedIcon className="size-4" />
          </Link>
          <AccountButton />
        </div>
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[26rem] px-4"
        style={{ paddingBottom: "max(0.85rem, env(safe-area-inset-bottom))" }}
      >
        <div className="glass-strong relative flex items-center gap-1 rounded-[1.75rem] p-1.5 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9)]">
          <div className="flex flex-1 items-center gap-1">
            {left.map((t) => (
              <TabLink key={t.to} {...t} active={t.match(pathname)} />
            ))}
          </div>

          <button
            type="button"
            onClick={onAdd}
            aria-label="Add bookmark"
            className="neon-glow -mt-7 grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90"
          >
            <Plus className="size-6" strokeWidth={2.6} />
          </button>

          <div className="flex flex-1 items-center gap-1">
            {right.map((t) => (
              <TabLink key={t.to} {...t} active={t.match(pathname)} />
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}

function TabLink({
  to,
  active,
  icon: Icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: typeof Bookmark;
  label: string;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] px-1 transition-colors ${
        active ? "bg-primary/12 text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="size-5" strokeWidth={active ? 2.4 : 1.9} />
      <span className={`text-[10px] leading-none font-medium ${active ? "" : "opacity-70"}`}>
        {label}
      </span>
    </Link>
  );
}
