import { createContext, useContext } from "react";

// Theme state lives in <ThemeProvider> (ThemeContext.jsx);
// useTheme() returns { mode, theme, setMode, toggle }.
export const ThemeContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}
