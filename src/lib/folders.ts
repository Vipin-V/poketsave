import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Camera,
  Car,
  Code2,
  Dumbbell,
  Film,
  Folder as FolderIcon,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Lightbulb,
  MessageCircle,
  Music,
  Palette,
  PawPrint,
  Plane,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "./bookmarks";

export type Folder = {
  id: Category; // built-in category id, or `f_xxxxxx` for custom folders
  label: string;
  icon: string; // key in ICONS
  color: string; // bg-folder-* class
  builtin?: boolean;
};

export const ICONS: Record<string, LucideIcon> = {
  globe: Globe,
  message: MessageCircle,
  briefcase: Briefcase,
  calendar: CalendarDays,
  book: BookOpen,
  plane: Plane,
  food: UtensilsCrossed,
  folder: FolderIcon,
  music: Music,
  code: Code2,
  game: Gamepad2,
  shopping: ShoppingBag,
  health: Stethoscope,
  fitness: Dumbbell,
  film: Film,
  camera: Camera,
  art: Palette,
  study: GraduationCap,
  money: Wallet,
  home: Home,
  car: Car,
  pet: PawPrint,
  gift: Gift,
  idea: Lightbulb,
  heart: Heart,
  sparkles: Sparkles,
};

export const COLORS = [
  "bg-folder-sky",
  "bg-folder-lime",
  "bg-folder-pink",
  "bg-folder-amber",
  "bg-folder-slate",
  "bg-folder-orange",
  "bg-folder-rose",
];

export const BUILTIN_FOLDERS: Folder[] = [
  { id: "website", label: "Websites", icon: "globe", color: "bg-folder-sky", builtin: true },
  { id: "social", label: "Social", icon: "message", color: "bg-folder-lime", builtin: true },
  { id: "job", label: "Jobs & Internships", icon: "briefcase", color: "bg-folder-pink", builtin: true },
  { id: "event", label: "Events", icon: "calendar", color: "bg-folder-amber", builtin: true },
  { id: "reading", label: "Reading", icon: "book", color: "bg-folder-slate", builtin: true },
  { id: "travel", label: "Travel", icon: "plane", color: "bg-folder-orange", builtin: true },
  { id: "food", label: "Food", icon: "food", color: "bg-folder-rose", builtin: true },
];

export const NEW_USER_FOLDER_IDS: Category[] = ["website", "social", "job"];

export const iconFor = (f: Pick<Folder, "icon">) => ICONS[f.icon] ?? FolderIcon;

export const isCustomCategory = (c: string) => c.startsWith("f_");

export const newFolderId = () =>
  `f_${Math.random().toString(36).slice(2, 8)}` as Category;

// Folder a bookmark category resolves to (internships share the Jobs folder).
export const folderKey = (c: Category): Category => (c === "internship" ? "job" : c);

// Labels of the user's custom folders, kept in sync by FoldersProvider so
// plain helpers like categoryLabel() can name custom folders too.
export const customLabels = new Map<string, string>();
