import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Account, Client, Teams } from "node-appwrite";

// Joining an album via a shared link should be instant — no email round trip.
// Appwrite's client SDK only offers email-confirmed team invites, so this runs
// server-side with an API key, which is the one context where Appwrite adds a
// team member immediately. The caller's identity comes from their own JWT, so
// this can only ever add the signed-in user themselves to the requested team.
export const joinAlbumByLink = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ teamId: z.string().min(1), jwt: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const endpoint = process.env["VITE_APPWRITE_ENDPOINT"];
    const projectId = process.env["VITE_APPWRITE_PROJECT_ID"];
    const apiKey = process.env["APPWRITE_API_KEY"];
    if (!endpoint || !projectId || !apiKey) {
      return { ok: false as const, error: "not_configured" as const };
    }

    const userClient = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(data.jwt);
    const me = await new Account(userClient).get().catch(() => null);
    if (!me) return { ok: false as const, error: "unauthorized" as const };

    const adminClient = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const teams = new Teams(adminClient);

    try {
      await teams.createMembership({ teamId: data.teamId, roles: ["member"], userId: me.$id });
    } catch (err) {
      // Already a member — treat as success rather than surfacing an error.
      const status = (err as { code?: number }).code;
      if (status !== 409) return { ok: false as const, error: "join_failed" as const };
    }

    return { ok: true as const };
  });
