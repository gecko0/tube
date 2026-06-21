import { AppProviders } from "@/app/app-providers"
import { AuthGate } from "@/app/auth-gate"
import { VideosPage } from "@/features/videos/videos-page"

export default function App() {
  return (
    <AppProviders>
      <AuthGate>
        <VideosPage />
      </AuthGate>
    </AppProviders>
  )
}
