import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bookmark,
  Briefcase,
  CalendarDays,
  Coffee,
  Menu,
  Plus,
  Star,
  User,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export function PhoneShell({
  children,
  onAdd,
  hideMenu,
}: {
  children: ReactNode;
  onAdd: () => void;
  // Pages that render their own hamburger menu (e.g. an album's) set this so
  // this global one doesn't also show up alongside it.
  hideMenu?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const left = TABS.slice(0, 2);
  const right = TABS.slice(3);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col">
      <main
        className="flex-1 px-4 pb-40"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        {!hideMenu && (
          <div className="mb-3 flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Menu"
                  className="glass grid size-11 place-items-center rounded-full"
                >
                  <Menu className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl border-border bg-popover p-1.5 text-popover-foreground"
              >
                <DropdownMenuItem
                  onClick={() => setAccountOpen(true)}
                  className="gap-2 rounded-xl py-2.5 focus:bg-accent"
                >
                  <User className="size-4 text-primary" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-2 rounded-xl py-2.5 focus:bg-accent">
                  <Link to="/favorites">
                    <Star className="size-4 text-primary" /> Favourites
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="gap-2 rounded-xl py-2.5 focus:bg-accent">
                  <a href="https://buymeacoffee.com/vipinv" target="_blank" rel="noreferrer">
                    <Coffee className="size-4 text-warn" /> Support developer
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AccountButton open={accountOpen} onOpenChange={setAccountOpen} hideTrigger />
          </div>
        )}
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
