"use client";

import { Icon } from "@/components/icons";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({ label = false }: { label?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  return <button className="icon-button" type="button" onClick={toggleTheme} aria-label={`Aktifkan tema ${theme === "dark" ? "terang" : "gelap"}`} title={`Tema ${theme === "dark" ? "terang" : "gelap"}`}>
    <Icon name={theme === "dark" ? "sun" : "moon"}/>
    {label && <span>{theme === "dark" ? "Tema terang" : "Tema gelap"}</span>}
  </button>;
}
