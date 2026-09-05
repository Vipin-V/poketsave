import { BookOpen, Briefcase, CalendarDays, Globe, MessageCircle } from "lucide-react";
import type { Category } from "./bookmarks";

// The Library is organised as folders. Each folder is one bookmark category,
// so no extra data is stored — the grouping is derived from what's saved.
export const FOLDERS: {
  category: Category;
  label: string;
  color: string;
  icon: typeof Briefcase;
}[] = [
  { category: "website", label: "Websites", color: "bg-folder-sky", icon: Globe },
  { category: "social", label: "Social", color: "bg-folder-lime", icon: MessageCircle },
  // Jobs and internships live together in one folder.
  { category: "job", label: "Jobs & Internships", color: "bg-folder-pink", icon: Briefcase },
  { category: "event", label: "Events", color: "bg-folder-amber", icon: CalendarDays },
  { category: "reading", label: "Reading", color: "bg-folder-slate", icon: BookOpen },
];

// Internships share the Jobs folder — both categories resolve to it.
export const folderFor = (c: Category) =>
  FOLDERS.find((f) => f.category === (c === "internship" ? "job" : c)) ?? FOLDERS[0]!;

// Does a bookmark of `cat` belong in the collection page for `folder`?
export const inFolder = (cat: Category, folder: string) =>
  cat === folder || (folder === "job" && cat === "internship");
