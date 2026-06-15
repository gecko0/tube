import { useCallback, useEffect, useMemo, useState } from "react"
import { Show, SignInButton, SignUpButton } from "@clerk/react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../convex/_generated/api"
import { Ellipsis, LogIn, Settings, Trash2, UserPlus } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { VideoDetail } from "@/components/video-detail"
import { SettingsPage } from "@/components/settings-page"
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

type View = "video" | "settings"

function getVideoIdFromPath() {
  const match = window.location.pathname.match(/^\/video\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

function getViewFromPath(): View {
  if (window.location.pathname === "/settings") return "settings"
  return "video"
}

function AuthenticatedApp() {
  const videos = useQuery(api.videos.list)
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(getVideoIdFromPath)
  const [view, setView] = useState<View>(getViewFromPath)
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
    setView("video")
    window.history.pushState(null, "", `/video/${videoId}`)
  }, [])

  const openSettings = useCallback(() => {
    setView("settings")
    window.history.pushState(null, "", "/settings")
  }, [])

  const handleDelete = useCallback(async () => {
    if (!selectedVideoId) return
    await removeVideo({ videoId: selectedVideoId })
  }, [selectedVideoId, removeVideo])

  // After videos update, if selected video is gone, pick next one
  useEffect(() => {
    if (!selectedVideoId || loading || view !== "video") return
    const stillExists = sortedVideos.some((v) => v.videoId === selectedVideoId)
    if (!stillExists) {
      if (sortedVideos.length > 0) {
        selectVideo(sortedVideos[0].videoId)
      } else {
        setSelectedVideoId(null)
        window.history.pushState(null, "", "/")
      }
    }
  }, [sortedVideos, selectedVideoId, loading, selectVideo, view])

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      setSelectedVideoId(getVideoIdFromPath())
      setView(getViewFromPath())
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // Auto-select the latest video if no video in URL
  useEffect(() => {
    if (sortedVideos.length > 0 && selectedVideoId === null && view === "video") {
      selectVideo(sortedVideos[0].videoId)
    }
  }, [sortedVideos, selectedVideoId, selectVideo, view])

  return (
    <SidebarProvider>
      <AppSidebar
        videos={sortedVideos}
        selectedVideoId={view === "video" ? selectedVideoId : null}
        onSelectVideo={selectVideo}
        onOpenSettings={openSettings}
        loading={loading}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 overflow-hidden border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {view === "settings"
              ? "Settings"
              : detail
                ? detail.title
                : "yt — YouTube Transcripts"}
          </span>
          {view === "video" && detail && (
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
          {view === "video" && !detail && !loading && (
            <Button variant="ghost" size="icon" className="shrink-0 -mr-1" onClick={openSettings}>
              <Settings className="size-4" />
            </Button>
          )}
        </header>
        {view === "video" && detail && (
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
          {view === "settings" ? (
            <SettingsPage />
          ) : detail === undefined && selectedVideoId ? (
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

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <Show when="signed-in">
          <AuthenticatedApp />
        </Show>
        <Show when="signed-out">
          <div className="flex min-h-screen items-center justify-center bg-background px-6">
            <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-normal">
                  yt — YouTube Transcripts
                </h1>
                <p className="text-sm text-muted-foreground">
                  Sign in or create an account to continue.
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2">
                <SignInButton mode="modal">
                  <Button variant="outline" className="w-full">
                    <LogIn className="size-4" />
                    Sign in
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button className="w-full">
                    <UserPlus className="size-4" />
                    Sign up
                  </Button>
                </SignUpButton>
              </div>
            </div>
          </div>
        </Show>
      </TooltipProvider>
    </ThemeProvider>
  )
}
