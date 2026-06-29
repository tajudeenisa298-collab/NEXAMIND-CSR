"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === "light" ? Moon : Sun;

  return (
    <button className="button secondary" onClick={toggleTheme} type="button">
      <Icon size={16} />
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}

