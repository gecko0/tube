import type { ReactNode } from "react"
import { RedirectToSignIn, useAuth } from "@clerk/react"
import { useConvexAuth } from "convex/react"
import { AuthStatus } from "@/app/auth-status"

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (!isLoaded || (isSignedIn && isLoading)) {
    return <AuthStatus>Loading...</AuthStatus>
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />
  }

  if (isAuthenticated) {
    return <>{children}</>
  }

  return (
    <AuthStatus>
      Unable to authenticate with Convex. Check the Clerk Convex integration and
      CLERK_JWT_ISSUER_DOMAIN setting.
    </AuthStatus>
  )
}
