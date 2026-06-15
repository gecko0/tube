import type { ReactNode } from "react"
import { ThemeContext, useThemeState } from "@/hooks/use-theme"

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeState = useThemeState()
  return (
    <ThemeContext value={themeState}>
      {children}
    </ThemeContext>
  )
}
