import { Link, useRouterState } from "@tanstack/react-router";
import { Bookmark, Briefcase, CalendarDays, Plus, Star } from "lucide-react";
import type { ReactNode } from "react";

export function PhoneShell({
  children,
  onAdd,
}: {
  children: ReactNode;
  onAdd: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col">
      <main
        className="flex-1 px-4 pb-36"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[26rem] px-4"
        style={{ paddingBottom: "max(0.85rem, env(safe-area-inset-bottom))" }}
      >
        <div className="glass-strong flex items-center rounded-3xl px-2 py-2 shadow-2xl">
          <div className="flex flex-1 items-center">
            <TabLink to="/" active={pathname === "/"} icon={<Bookmark className="size-5" />} label="Library" />
            <TabLink
              to="/calendar"
              active={pathname.startsWith("/calendar")}
              icon={<CalendarDays className="size-5" />}
              label="Calendar"
            />
          </div>
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add bookmark"
            className="neon-glow -mt-6 grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2.6} />
          </button>
          <div className="flex flex-1 items-center">
            <TabLink
              to="/jobs"
              active={pathname.startsWith("/jobs")}
              icon={<Briefcase className="size-5" />}
              label="Jobs"
            />
            <TabLink
              to="/favorites"
              active={pathname.startsWith("/favorites")}
              icon={<Star className="size-5" />}
              label="Saved"
            />
          </div>
        </div>
      </nav>
    </div>
  );
}

function TabLink({
  to,
  active,
  icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-medium transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
