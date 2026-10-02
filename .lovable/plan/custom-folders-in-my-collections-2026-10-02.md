# Custom folders in My Collections

## What you'll get

- **New users** start with four folders: Websites, Social, Jobs & Internships, and Favourites.
- **Existing users** keep every folder they have today (Websites, Social, Jobs & Internships, Events, Reading, Travel, Food, Favourites). No bookmarks move or disappear, and they get the add and delete options too.
- **New folder button:** a "+ New folder" tile at the end of My Collections opens a small sheet. You type a name, pick an icon from a grid of about 24 (music, code, gaming, shopping, health, and so on), and pick a colour.
- **Saving into a folder:** custom folders appear as choices in the "Save a link" category picker. Adding a link from inside a custom folder pre-selects that folder.
- **Delete folder:** a trash button at the top of an open folder (Favourites can't be deleted). It opens a confirmation showing how many links are inside. The Delete button stays locked with a 5-second countdown ("Delete in 5… 4…") before you can press it.
- **What happens to the links:** deleting a folder never deletes your bookmarks. They move to Websites, so nothing is lost.
- **Syncs across devices:** your folder list saves to your account when you're signed in, and to the phone when you're signed out. It merges into your account when you sign in, the same way bookmarks already do.
- **Safety net:** if a bookmark ever points to a folder that isn't in your list, that folder shows up again on its own.

## Technical details

- `src/lib/folders.ts`: a `Folder` type `{ id, label, icon, color, builtin? }` and an icon registry (a lucide name-to-component map). Built-in folder ids equal today's categories, and custom ids look like `f_xxxxxx` (short, so they fit the existing category field).
- `Category` widens to `BuiltinCategory | \`f_${string}`. The bookmark document's` category` is already a free string, so no schema change is needed.
- `src/hooks/use-folders.tsx`: a provider holding the folder list. It's stored in Appwrite account prefs (`folders`) when signed in, and in localStorage when signed out. Initial seed: if nothing is saved yet and the user already has bookmarks, seed all 7 built-ins; otherwise seed the 3 defaults. It exposes `folders`, `addFolder`, and `deleteFolder(id)`, which re-categorises that folder's bookmarks to `website` through the existing `update()` and then removes the folder.
- `index.tsx` renders from `useFolders()` instead of the static `FOLDERS`, plus the New folder tile. `collection.$category.tsx`, `LinkTile`, and `AddBookmarkSheet` read from the hook. Jobs and internships keep their special handling (the deadline tag, plus the Jobs tab and Calendar for job/internship/event).
- New components: `NewFolderSheet.tsx` and `DeleteFolderDialog.tsx` (an AlertDialog with a 10-second countdown that disables the action).