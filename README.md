# Pocket

A mobile-first bookmark vault: save links from X, Reddit, Instagram, articles, or job postings, and find them again fast. Job bookmarks get a company/role/deadline field and a countdown that turns amber then red as the application window closes. Shared albums let two or more people collaborate on one list — everyone adds bookmarks and sees the same deadline alerts.

Built with TanStack Start, React 19, Tailwind CSS v4, and Appwrite (database + auth). Bookmarks work fully offline in the browser's local storage; signing in with Google backs them up and syncs them across devices.

## Setup

1. **Install dependencies**
   ```sh
   bun install
   ```

2. **Create an Appwrite project** — [cloud.appwrite.io](https://cloud.appwrite.io) has a free tier that covers this app comfortably; if you have the [GitHub Student Developer Pack](https://education.github.com/pack), Appwrite's listing there upgrades you to the Pro plan at no cost. Under your project's *Overview*, add a **Web** platform for the domain you'll run this on (`localhost` for dev, plus your Vercel domain later).

3. **Create a database and collection** — make a database, then inside it a `bookmarks` collection with **Document Security** turned on. Add these attributes (all match `src/lib/bookmarks.ts`'s `Bookmark` type):

   | Attribute | Type | Required |
   |---|---|---|
   | `url`, `title`, `domain`, `category` | String | Yes |
   | `description`, `image`, `favicon`, `notes`, `company`, `role` | String | No |
   | `deadline`, `interviewDate` | String (`yyyy-mm-dd`) | No |
   | `tags` | String, array | No |
   | `applied`, `favorite` | Boolean | Yes (default `false`) |

   No `userId` field is needed — per-document permissions (set automatically when a bookmark is created) already scope each document to its owner. Under this collection's **Settings → Permissions**, grant the `Users` role **Create** only (leave Read/Update/Delete unchecked — those come from each document's own permissions).

   Add one more attribute for shared albums:

   | Attribute | Type | Required |
   |---|---|---|
   | `albumId` | String | No |

   Then create a second collection called `albums`, also with **Document Security** turned on, same `Users` role with **Create** only:

   | Attribute | Type | Required |
   |---|---|---|
   | `name`, `emoji`, `teamId`, `ownerId`, `ownerName` | String | Yes |

   Shared albums use Appwrite's built-in **Teams** feature (no setup needed — every project has it) so that anyone who joins later automatically gets access to everything already saved. Joining happens via a shareable link (`/albums/join/:id`) rather than an emailed invite — see the next step.

4. **Enable Google sign-in** (optional — the app works fully without an account) — under *Auth → Settings*, enable the **Google** OAuth provider with a Client ID/Secret from a Google Cloud OAuth app. Appwrite's provider page shows you the exact redirect URI to register in Google Cloud Console.

5. **Create an API key for instant album joins** — under *Overview → Integrate with your server* (or *Project Settings → API Keys*), create a key with just the **teams.write** scope. This lets the app add someone to an album's team the moment they open an invite link, with no email confirmation step. Keep this key server-side only.

6. **Configure environment variables** — copy `.env.example` to `.env` and fill in your project's endpoint, project ID, database ID, both collection IDs, and the API key from the previous step (all visible in the Appwrite console):
   ```sh
   cp .env.example .env
   ```

7. **Run it**
   ```sh
   bun dev
   ```

## Deploying

The build targets Vercel out of the box (via Nitro's `vercel` preset in `vite.config.ts`). Connect the repo in Vercel or run `vercel deploy`, and add the same environment variables from `.env` to the Vercel project's settings.
