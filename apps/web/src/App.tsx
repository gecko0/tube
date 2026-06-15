import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { RedirectToSignIn, useAuth } from "@clerk/react"
import {
  useMutation,
  useConvexAuth,
  useQuery,
} from "convex/react"
import { api } from "../convex/_generated/api"
import { Ellipsis, Trash2 } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { VideoDetail } from "@/components/video-detail"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

function getVideoIdFromPath() {
  const match = window.location.pathname.match(/^\/video\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

function AuthenticatedApp() {
  const videos = useQuery(api.videos.list)
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(getVideoIdFromPath)
  const detail = useQuery(
    api.videos.get,
    selectedVideoId ? { videoId: selectedVideoId } : "skip"
  )
  const removeVideo = useMutation(api.videos.remove)
  const [alertOpen, setAlertOpen] = useState(false)

  const loading = videos === undefined
  const sortedVideos = useMemo(() => videos ? [...videos] : [], [videos])

  const selectVideo = useCallback((videoId: string) => {
    setSelectedVideoId(videoId)
    window.history.pushState(null, "", `/video/${videoId}`)
  }, [])

  const handleDelete = useCallback(async () => {
    if (!selectedVideoId) return
    await removeVideo({ videoId: selectedVideoId })
  }, [selectedVideoId, removeVideo])

  // After videos update, if selected video is gone, pick next one
  useEffect(() => {
    if (!selectedVideoId || loading) return
    const stillExists = sortedVideos.some((v) => v.videoId === selectedVideoId)
    if (!stillExists) {
      if (sortedVideos.length > 0) {
        selectVideo(sortedVideos[0].videoId)
      } else {
        setSelectedVideoId(null)
        window.history.pushState(null, "", "/")
      }
    }
  }, [sortedVideos, selectedVideoId, loading, selectVideo])

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      setSelectedVideoId(getVideoIdFromPath())
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // Auto-select the latest video if no video in URL
  useEffect(() => {
    if (sortedVideos.length > 0 && selectedVideoId === null) {
      selectVideo(sortedVideos[0].videoId)
    }
  }, [sortedVideos, selectedVideoId, selectVideo])

  return (
    <SidebarProvider>
      <AppSidebar
        videos={sortedVideos}
        selectedVideoId={selectedVideoId}
        onSelectVideo={selectVideo}
        loading={loading}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 overflow-hidden border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {detail ? detail.title : "yt — YouTube Transcripts"}
          </span>
          {detail && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 -mr-1">
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setAlertOpen(true)}
                >
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        {detail && (
          <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this video?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the transcript and summary for{" "}
                  <strong>{detail.title}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <main className="flex-1 overflow-auto">
          {detail === undefined && selectedVideoId ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : detail ? (
            <VideoDetail detail={detail} />
          ) : (
            <div className="flex items-center justify-center h-64">
              <span className="text-muted-foreground">
                Select a video from the sidebar
              </span>
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AuthStatus({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <span className="text-sm text-muted-foreground">{children}</span>
    </div>
  )
}

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth()
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (!isLoaded || (isSignedIn && isLoading)) {
    return <AuthStatus>Loading...</AuthStatus>
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />
  }

  if (isAuthenticated) {
    return <AuthenticatedApp />
  }

  return (
    <AuthStatus>
      Unable to authenticate with Convex. Check the Clerk Convex integration and
      CLERK_JWT_ISSUER_DOMAIN setting.
    </AuthStatus>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <AuthGate />
      </TooltipProvider>
    </ThemeProvider>
  )
}
