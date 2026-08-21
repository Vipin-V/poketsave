import { useEffect, useState } from "react";
import { BellRing, Mail } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import {
  DEFAULT_NOTIFY_HOUR_UTC,
  disableDeadlineAlerts,
  enableDeadlineAlerts,
  localHourToUtcHour,
  setEmailAlerts,
  setNotifyHour,
  utcHourToLocalHour,
} from "@/lib/push";

function formatHour12(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${period}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Notifications need a signed-in account (prefs live server-side) — lets
  // the parent open the Profile sheet instead when there's no user yet.
  onSignInRequested: () => void;
};

export function NotificationsButton({ open, onOpenChange, onSignInRequested }: Props) {
  const { user } = useAuth();
  const [alertsOn, setAlertsOn] = useState(false);
  const [togglingAlerts, setTogglingAlerts] = useState(false);
  const [emailAlertsOn, setEmailAlertsOn] = useState(false);
  const [togglingEmailAlerts, setTogglingEmailAlerts] = useState(false);
  const [notifyHourUtc, setNotifyHourUtc] = useState(DEFAULT_NOTIFY_HOUR_UTC);

  useEffect(() => {
    setAlertsOn(Boolean(user?.prefs?.["pushSubscription"]));
    setEmailAlertsOn(Boolean(user?.prefs?.["emailAlerts"]));
    setNotifyHourUtc(Number(user?.prefs?.["notifyHour"] ?? DEFAULT_NOTIFY_HOUR_UTC));
  }, [user]);

  async function changeNotifyHour(localHour: number) {
    if (!user) return;
    const previousUtcHour = notifyHourUtc;
    const utcHour = localHourToUtcHour(localHour);
    setNotifyHourUtc(utcHour);
    try {
      await setNotifyHour(utcHour);
    } catch {
      setNotifyHourUtc(previousUtcHour);
      toast("Couldn't update notification time — try again.");
    }
  }

  async function toggleAlerts(checked: boolean) {
    if (!user) return;
    setTogglingAlerts(true);
    try {
      if (checked) {
        const result = await enableDeadlineAlerts();
        if (result === "enabled") {
          setAlertsOn(true);
          toast("Deadline alerts on — 4 days before, 1 day before, and the day of.");
        } else if (result === "unsupported") {
          toast("Push notifications aren't supported in this browser.");
        } else if (result === "denied") {
          toast("Notification permission wasn't granted.");
        } else {
          toast("Deadline alerts aren't set up yet.");
        }
      } else {
        await disableDeadlineAlerts();
        setAlertsOn(false);
        toast("Deadline alerts off.");
      }
    } catch {
      toast("Couldn't update deadline alerts — try again.");
    } finally {
      setTogglingAlerts(false);
    }
  }

  async function toggleEmailAlerts(checked: boolean) {
    if (!user) return;
    setTogglingEmailAlerts(true);
    try {
      await setEmailAlerts(checked);
      setEmailAlertsOn(checked);
      toast(checked ? `Email alerts on — sent to ${user.email}.` : "Email alerts off.");
    } catch {
      toast("Couldn't update email alerts — try again.");
    } finally {
      setTogglingEmailAlerts(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong mx-auto w-full max-w-[26rem] rounded-t-3xl border-border px-4 pb-8"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="font-display text-xl">Notifications</SheetTitle>
        </SheetHeader>
        {user ? (
          <div className="glass mt-3 rounded-2xl p-3.5">
            <div className="flex items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <BellRing className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Deadline alerts</p>
                <p className="text-xs text-muted-foreground">
                  Notify me 4 days before, 1 day before, and the day of a job, internship or event
                  date
                </p>
              </div>
              <Switch
                checked={alertsOn}
                disabled={togglingAlerts}
                onCheckedChange={(checked) => void toggleAlerts(checked)}
              />
            </div>
            <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Mail className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Email alerts</p>
                <p className="truncate text-xs text-muted-foreground">
                  Same reminders, sent to {user.email}
                </p>
              </div>
              <Switch
                checked={emailAlertsOn}
                disabled={togglingEmailAlerts}
                onCheckedChange={(checked) => void toggleEmailAlerts(checked)}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Send alerts around</p>
              <Select
                value={String(utcHourToLocalHour(notifyHourUtc))}
                disabled={!alertsOn && !emailAlertsOn}
                onValueChange={(value) => void changeNotifyHour(Number(value))}
              >
                <SelectTrigger className="h-8 w-28 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <SelectItem key={hour} value={String(hour)}>
                      {formatHour12(hour)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="pt-2 pb-1 text-center">
            <div className="neon-glow mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15">
              <BellRing className="size-6 text-primary" />
            </div>
            <p className="mx-auto mt-3 max-w-[19rem] text-sm text-muted-foreground">
              Sign in to get deadline alerts by push and email.
            </p>
            <Button
              className="neon-glow mt-5 h-12 w-full rounded-2xl text-sm font-semibold"
              onClick={() => {
                onOpenChange(false);
                onSignInRequested();
              }}
            >
              Go to profile to sign in
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
