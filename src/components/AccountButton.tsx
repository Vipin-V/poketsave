import { useEffect, useState } from "react";
import { User as UserIcon, LogOut, Loader2, Check, CloudUpload, BellRing } from "lucide-react";
import { toast } from "sonner";
import { OAuthProvider } from "appwrite";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { account, isAppwriteConfigured } from "@/integrations/appwrite/client";
import { useAuth } from "@/hooks/use-auth";
import { disableDeadlineAlerts, enableDeadlineAlerts } from "@/lib/push";

type Props = {
  // Lets a parent (e.g. a menu item) open the account sheet itself instead
  // of relying on the built-in trigger button.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export function AccountButton({ open: openProp, onOpenChange, hideTrigger }: Props = {}) {
  const { user, ready } = useAuth();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [alertsOn, setAlertsOn] = useState(false);
  const [togglingAlerts, setTogglingAlerts] = useState(false);

  const name = user?.name || user?.email || "";

  useEffect(() => {
    setAlertsOn(Boolean(user?.prefs?.["pushSubscription"]));
  }, [user]);

  async function toggleAlerts(checked: boolean) {
    if (!user) return;
    setTogglingAlerts(true);
    try {
      if (checked) {
        const result = await enableDeadlineAlerts(user);
        if (result === "enabled") {
          setAlertsOn(true);
          toast("Deadline alerts on — 4 days and 1 day before a date arrives.");
        } else if (result === "unsupported") {
          toast("Push notifications aren't supported in this browser.");
        } else if (result === "denied") {
          toast("Notification permission wasn't granted.");
        } else {
          toast("Deadline alerts aren't set up yet.");
        }
      } else {
        await disableDeadlineAlerts(user);
        setAlertsOn(false);
        toast("Deadline alerts off.");
      }
    } catch {
      toast("Couldn't update deadline alerts — try again.");
    } finally {
      setTogglingAlerts(false);
    }
  }

  function signIn() {
    if (!isAppwriteConfigured) {
      toast("Sync isn't set up yet — add your Appwrite project details to .env first.");
      return;
    }
    setSigningIn(true);
    try {
      account.createOAuth2Session({
        provider: OAuthProvider.Google,
        success: window.location.origin,
        failure: window.location.origin,
      });
    } catch {
      toast("Couldn't sign in with Google — try again.");
      setSigningIn(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await account.deleteSession("current");
      window.location.reload();
    } catch {
      toast("Couldn't sign out — try again.");
      setSigningOut(false);
    }
  }

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={user ? "Account" : "Sign in"}
          className="glass grid size-11 shrink-0 place-items-center overflow-hidden rounded-full"
        >
          {ready && user ? (
            <Avatar className="size-11">
              <AvatarFallback className="bg-transparent text-xs font-semibold text-primary">
                {name.slice(0, 1).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          ) : (
            <UserIcon className="size-4 text-muted-foreground" />
          )}
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="glass-strong mx-auto w-full max-w-[26rem] rounded-t-3xl border-border px-4 pb-8"
        >
          {user ? (
            <>
              <SheetHeader className="px-0">
                <SheetTitle className="font-display text-xl">Your account</SheetTitle>
              </SheetHeader>
              <div className="flex items-center gap-3 py-2">
                <Avatar className="size-12">
                  <AvatarFallback className="bg-secondary text-sm font-semibold">
                    {name.slice(0, 1).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  <p className="text-xs text-muted-foreground">Synced with your Google account</p>
                </div>
              </div>
              <div className="glass mt-3 flex items-center gap-3 rounded-2xl p-3.5">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <BellRing className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Deadline alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Notify me 4 days and 1 day before a job, internship or event date
                  </p>
                </div>
                <Switch
                  checked={alertsOn}
                  disabled={togglingAlerts}
                  onCheckedChange={(checked) => void toggleAlerts(checked)}
                />
              </div>
              <Button
                variant="secondary"
                className="mt-3 h-12 w-full rounded-2xl"
                onClick={() => void signOut()}
                disabled={signingOut}
              >
                {signingOut ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <LogOut className="mr-1 size-4" />
                )}
                Sign out
              </Button>
            </>
          ) : (
            <div className="pt-2 pb-1 text-center">
              <div className="neon-glow mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15">
                <CloudUpload className="size-6 text-primary" />
              </div>
              <SheetHeader className="items-center px-0">
                <SheetTitle className="font-display text-[22px]">Keep everything in sync</SheetTitle>
              </SheetHeader>
              <p className="mx-auto max-w-[19rem] text-sm text-muted-foreground">
                Your saves live only on this device right now. Sign in to back them up and open them
                anywhere.
              </p>
              <ul className="mt-4 space-y-2 text-left">
                {[
                  "Bookmarks and job deadlines on every device",
                  "Nothing lost if you clear your browser",
                  "Shared albums with friends",
                ].map((line) => (
                  <li key={line} className="flex items-center gap-2.5 text-sm">
                    <Check className="size-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{line}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="neon-glow mt-5 h-13 w-full rounded-2xl text-base font-semibold"
                onClick={signIn}
                disabled={signingIn}
              >
                {signingIn ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Continue with Google
              </Button>
              <p className="mt-3 text-[11px] text-muted-foreground">
                We only use your account to sync your saves.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
