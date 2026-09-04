// Theme is stored locally and applied by toggling the `dark` class on <html>.
// Dark is the default when nothing has been chosen yet.
export type Theme = "dark" | "light";

const KEY = "poketsave.theme";

export function loadTheme(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  return localStorage.getItem(KEY) === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(KEY, theme);
}
