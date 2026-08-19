# Pocket — a mobile bookmark vault with job deadline alerts

A mobile-first web app for saving any link (X post, Reddit thread, article, job posting) and finding it again fast. Jobs get deadline tracking with in-app countdown alerts. Everything is stored locally on the device — no login.

## Look and feel

Dark minimal base with glassy neon accents: near-black background, frosted translucent cards, a single neon accent (electric cyan/violet) used sparingly for focus rings, countdown urgency, and the add button. Large type, generous spacing, no clutter.

Responsive for all phone sizes: fluid layout from 320px (iPhone SE) up through 430px+ (Pro Max / large Android), safe-area insets for notch and home indicator, tap targets at least 44px, bottom-anchored navigation reachable by thumb. On tablet/desktop the app renders centered in a phone-width column so it still looks intentional.

## Screens

1. **Home / Library** — search bar, filter chips (All, Jobs, Reading, Social, Websites), and a list of saved bookmark cards showing favicon, title, source domain, tags, and saved date. Empty state invites the first save.
2. **Add bookmark** — sheet that slides up: paste a URL, the app fetches title, description, favicon and preview image automatically, then lets you edit the title, pick a category, add tags and notes. If the category is Job, extra fields appear: company, role, and application deadline.
3. **Jobs / Deadlines** — jobs sorted by nearest deadline, each with a countdown ("3 days left") and colour urgency: neon accent when far out, amber under 7 days, red under 2 days, muted when expired. An "Expiring soon" banner appears on Home when any job deadline is within 7 days.
4. **Bookmark detail** — full preview image, notes, tags, open-original button, mark job as applied, edit, delete.

## Behaviour

- Search matches title, notes, tags and domain.
- Categories auto-guess from the domain (x.com → Social, linkedin.com/jobs → Job, etc.), user can override.
- Jobs can be marked Applied so they drop out of the urgency list but stay saved.
- All data persists in the phone's local storage and survives reloads.

## Technical notes

- Routes: `/` (library), `/jobs`, `/bookmark/$id`; add/edit as an overlay sheet. Each route gets its own head() metadata.
- Link metadata fetch runs through a TanStack server function that fetches the URL and parses OpenGraph/`<title>`/favicon tags, so browser CORS doesn't block it. Graceful fallback to manual entry when a site blocks scraping.
- Storage layer is a small typed local-storage module (`bookmarks`, schema-versioned) behind a hook, so a future cloud sync is a drop-in swap.
- Deadline logic is pure date math computed on render; no background jobs needed for in-app alerts.
- Design tokens (dark palette, neon accent, glass surfaces, radii) go into `src/styles.css` as semantic tokens; components use tokens only.
