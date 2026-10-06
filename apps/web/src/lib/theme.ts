export type Theme = "light" | "dark";
export const THEME_KEY = "medlink:theme";

/**
 * Runs before first paint (inlined in <head>) so there is no flash of the wrong theme.
 * An explicit choice wins; otherwise the OS setting.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function currentTheme(): Theme {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light";
}
