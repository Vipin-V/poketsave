import type { Category } from "./bookmarks";

// Does a bookmark of `cat` belong in the collection page for `folder`?
// Internships share the Jobs folder.
export const inFolder = (cat: Category, folder: string) =>
  cat === folder || (folder === "job" && cat === "internship");
