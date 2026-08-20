import { useEffect, useState } from "react";
import type { Models } from "appwrite";
import { account, isAppwriteConfigured } from "@/integrations/appwrite/client";

export function useAuth() {
  const [user, setUser] = useState<Models.User<Models.DefaultPreferences> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAppwriteConfigured) {
      setReady(true);
      return;
    }
    account
      .get()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  return { user, ready };
}
