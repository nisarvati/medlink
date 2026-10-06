"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyTheme, currentTheme, THEME_KEY, type Theme } from "../../lib/theme";
import { writeStorage } from "../../lib/storage";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => undefined });
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  // The inline script in <head> already set the class; read it back so the toggle shows the right icon.
  useEffect(() => setTheme(currentTheme()), []);
  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    writeStorage(THEME_KEY, next);
    setTheme(next);
  }, []);
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
