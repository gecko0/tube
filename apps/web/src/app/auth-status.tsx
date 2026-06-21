import type { ReactNode } from "react"

export function AuthStatus({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <span className="text-sm text-muted-foreground">{children}</span>
    </div>
  )
}
