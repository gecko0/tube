import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { RedirectToSignIn, useAuth } from "@clerk/react"
import {
  useMutation,
  useConvexAuth,
  useQuery,
  usePaginatedQuery,
} from "convex/react"
import { api } from "../convex/_generated/api"
import { Archive, ArchiveRestore, Ellipsis, Eye, EyeOff, Trash2 } from "lucide-react"
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
  DropdownMenuSeparator,
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
import type { VideoView } from "@/lib/types"

function getVideoIdFromPath() {
  const match = window.location.pathname.match(/^\/video\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

function AuthenticatedApp() {
  const [videoView, setVideoView] = useState<VideoView>("active")
  const {
    results: videos,
    status: videosStatus,
    loadMore: loadMoreVideos,
  } = usePaginatedQuery(
    api.videos.listPage,
    { view: videoView },
    { initialNumItems: 100 }
  )
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(getVideoIdFromPath)
  const detail = useQuery(
    api.videos.get,
    selectedVideoId ? { videoId: selectedVideoId } : "skip"
  )
  const archiveVideo = useMutation(api.videos.archive)
  const unarchiveVideo = useMutation(api.videos.unarchive)
  const removeVideo = useMutation(api.videos.remove)
  const markRead = useMutation(api.videos.markRead)
  const markUnread = useMutation(api.videos.markUnread)
  const suppressedAutoReadVideoId = useRef<string | null>(null)
  const [alertOpen, setAlertOpen] = useState(false)

  const loading = videosStatus === "LoadingFirstPage"
  const canLoadMoreVideos = videosStatus === "CanLoadMore"
  const loadingMoreVideos = videosStatus === "LoadingMore"
  const sortedVideos = useMemo(() => videos ? [...videos] : [], [videos])

  const selectVideo = useCallback((videoId: string) => {
    suppressedAutoReadVideoId.current = null
    setSelectedVideoId(videoId)
    window.history.pushState(null, "", `/video/${videoId}`)
  }, [])

  const loadMoreNextVideos = useCallback(() => {
    loadMoreVideos(100)
  }, [loadMoreVideos])

  const clearSelection = useCallback(() => {
    suppressedAutoReadVideoId.current = null
    setSelectedVideoId(null)
    window.history.pushState(null, "", "/")
  }, [])

  const selectNextVisibleVideo = useCallback((videoId: string) => {
    const currentIndex = sortedVideos.findIndex((video) => video.videoId === videoId)
    const fallback =
      sortedVideos[currentIndex + 1] ??
      sortedVideos[currentIndex - 1] ??
      sortedVideos.find((video) => video.videoId !== videoId)

    if (fallback && fallback.videoId !== videoId) {
      selectVideo(fallback.videoId)
    } else {
      clearSelection()
    }
  }, [clearSelection, selectVideo, sortedVideos])

  const handleViewChange = useCallback((view: VideoView) => {
    if (view === videoView) return
    setVideoView(view)
    clearSelection()
  }, [clearSelection, videoView])

  const handleArchiveToggle = useCallback(async () => {
    if (!selectedVideoId || !detail) return

    if (detail.archivedAt === undefined) {
      await archiveVideo({ videoId: selectedVideoId })
    } else {
      await unarchiveVideo({ videoId: selectedVideoId })
    }
    selectNextVisibleVideo(selectedVideoId)
  }, [archiveVideo, detail, selectedVideoId, selectNextVisibleVideo, unarchiveVideo])

  const handleReadToggle = useCallback(async () => {
    if (!selectedVideoId || !detail) return

    if (detail.readAt === undefined) {
      suppressedAutoReadVideoId.current = null
      await markRead({ videoId: selectedVideoId })
    } else {
      suppressedAutoReadVideoId.current = selectedVideoId
      await markUnread({ videoId: selectedVideoId })
    }
  }, [detail, markRead, markUnread, selectedVideoId])

  const handleDelete = useCallback(async () => {
    if (!selectedVideoId) return
    await removeVideo({ videoId: selectedVideoId })
    selectNextVisibleVideo(selectedVideoId)
  }, [selectedVideoId, removeVideo, selectNextVisibleVideo])

  useEffect(() => {
    if (!selectedVideoId || !detail || detail.readAt !== undefined) return
    if (suppressedAutoReadVideoId.current === selectedVideoId) return

    void markRead({ videoId: selectedVideoId })
  }, [detail, markRead, selectedVideoId])

  // After videos update, if selected video is gone, pick next one
  useEffect(() => {
    if (!selectedVideoId || loading || detail === undefined) return
    const stillExists = sortedVideos.some((v) => v.videoId === selectedVideoId)
    if (!stillExists && detail === null) {
      if (sortedVideos.length > 0) {
        selectVideo(sortedVideos[0].videoId)
      } else {
        setSelectedVideoId(null)
        window.history.pushState(null, "", "/")
      }
    }
  }, [sortedVideos, selectedVideoId, loading, detail, selectVideo])

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      suppressedAutoReadVideoId.current = null
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
        view={videoView}
        selectedVideoId={selectedVideoId}
        onSelectVideo={selectVideo}
        onViewChange={handleViewChange}
        loading={loading}
        canLoadMore={canLoadMoreVideos}
        loadingMore={loadingMoreVideos}
        onLoadMore={loadMoreNextVideos}
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
                <DropdownMenuItem onSelect={handleReadToggle}>
                  {detail.readAt === undefined ? (
                    <>
                      <Eye />
                      Mark as read
                    </>
                  ) : (
                    <>
                      <EyeOff />
                      Mark as unread
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleArchiveToggle}>
                  {detail.archivedAt === undefined ? (
                    <>
                      <Archive />
                      Archive
                    </>
                  ) : (
                    <>
                      <ArchiveRestore />
                      Unarchive
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
