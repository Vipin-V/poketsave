# Pocket

A mobile-first bookmark vault: save links from X, Reddit, Instagram, articles, or job postings, and find them again fast. Job bookmarks get a company/role/deadline field and a countdown that turns amber then red as the application window closes.

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
   | `deadline` | String (`yyyy-mm-dd`) | No |
   | `tags` | String, array | No |
   | `applied`, `favorite` | Boolean | Yes (default `false`) |

   No `userId` field is needed — per-document permissions (set automatically when a bookmark is created) already scope each document to its owner.

4. **Enable Google sign-in** (optional — the app works fully without an account) — under *Auth → Settings*, enable the **Google** OAuth provider with a Client ID/Secret from a Google Cloud OAuth app. Appwrite's provider page shows you the exact redirect URI to register in Google Cloud Console.

5. **Configure environment variables** — copy `.env.example` to `.env` and fill in your project's endpoint, project ID, database ID, and collection ID (all visible in the Appwrite console):
   ```sh
   cp .env.example .env
   ```

6. **Run it**
   ```sh
   bun dev
   ```

## Deploying

The build targets Vercel out of the box (via Nitro's `vercel` preset in `vite.config.ts`). Connect the repo in Vercel or run `vercel deploy`, and add the same environment variables from `.env` to the Vercel project's settings.
