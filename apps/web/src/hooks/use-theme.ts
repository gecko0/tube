import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function useThemeState() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as Theme) || "system"
    }
    return "system"
  })

  useEffect(() => {
    const root = document.documentElement

    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      root.classList.toggle("dark", prefersDark)

      const handler = (e: MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches)
      }
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }

    root.classList.toggle("dark", theme === "dark")
  }, [theme])

  const setThemeAndSave = (t: Theme) => {
    setTheme(t)
    localStorage.setItem("theme", t)
  }

  return { theme, setTheme: setThemeAndSave }
}
