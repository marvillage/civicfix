import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/theme";

// One-tap light/dark switch for headers.
export default function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className={`icon-button theme-toggle ${className}`}
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}

// Three-way choice for menus and the profile page.
export function ThemeChooser() {
  const { mode, setMode } = useTheme();

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div
      className="segmented theme-chooser"
      role="radiogroup"
      aria-label="Theme"
    >
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          className={mode === value ? "is-active" : ""}
          onClick={() => setMode(value)}
        >
          <Icon aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
