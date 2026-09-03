import { BookOpen, Briefcase, CalendarDays, Globe, GraduationCap, MessageCircle } from "lucide-react";
import type { Category } from "./bookmarks";

// The Library is organised as folders. Each folder is one bookmark category,
// so no extra data is stored — the grouping is derived from what's saved.
export const FOLDERS: {
  category: Category;
  label: string;
  color: string;
  icon: typeof Briefcase;
}[] = [
  { category: "job", label: "Jobs", color: "bg-folder-pink", icon: Briefcase },
  { category: "internship", label: "Internships", color: "bg-folder-violet", icon: GraduationCap },
  { category: "website", label: "Websites", color: "bg-folder-sky", icon: Globe },
  { category: "social", label: "Social", color: "bg-folder-lime", icon: MessageCircle },
  { category: "event", label: "Events", color: "bg-folder-amber", icon: CalendarDays },
  { category: "reading", label: "Reading", color: "bg-folder-slate", icon: BookOpen },
];

export const folderFor = (c: Category) => FOLDERS.find((f) => f.category === c) ?? FOLDERS[2]!;
