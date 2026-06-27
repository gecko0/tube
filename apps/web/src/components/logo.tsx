import type { CSSProperties, HTMLAttributes } from "react"

import { cn } from "@/lib/utils"
import logoUrl from "@/assets/logo.svg"

export function Logo({
  className,
  style,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  const mask = `url(${logoUrl}) center / contain no-repeat`

  return (
    <span
      role="img"
      aria-label="Stash"
      className={cn(
        "inline-block h-8 aspect-[721/268] bg-current text-sidebar-foreground",
        className
      )}
      style={
        {
          WebkitMask: mask,
          mask,
          ...style,
        } satisfies CSSProperties
      }
      {...props}
    />
  )
}
