import { useCallback, useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS } from "../brand";
import { readPref, writePref } from "../lib/session";
import { ThemeContext } from "./theme";

// Theme preference: "light" | "dark" | "system".
// The resolved theme is stamped on <html data-theme="…"> (index.html
// does the same before React loads, so there is no flash).
const MODES = ["light", "dark", "system"];

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)")
    .matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved = readPref(STORAGE_KEYS.theme);
    return MODES.includes(saved) ? saved : "system";
  });

  const [system, setSystem] = useState(systemTheme);

  useEffect(() => {
    const query = window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    );

    if (!query) return undefined;

    const onChange = () => setSystem(systemTheme());

    query.addEventListener("change", onChange);

    return () => query.removeEventListener("change", onChange);
  }, []);

  const theme = mode === "system" ? system : mode;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const choose = useCallback((next) => {
    setMode(next);
    writePref(STORAGE_KEYS.theme, next);
  }, []);

  const toggle = useCallback(() => {
    choose(theme === "dark" ? "light" : "dark");
  }, [choose, theme]);

  const value = useMemo(
    () => ({ mode, theme, setMode: choose, toggle }),
    [mode, theme, choose, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
