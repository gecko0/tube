import { useCallback, useEffect, useMemo, useState } from "react"
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
import { useVideoDetail } from "@/hooks/use-video-detail"
import { useVideos } from "@/hooks/use-videos"

function getVideoIdFromPath() {
  const match = window.location.pathname.match(/^\/video\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export default function App() {
  const { videos, loading, refresh } = useVideos()
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(getVideoIdFromPath)
  const { detail, loading: detailLoading } = useVideoDetail(selectedVideoId)
  const [alertOpen, setAlertOpen] = useState(false)

  const sortedVideos = useMemo(() => [...videos].reverse(), [videos])

  const selectVideo = useCallback((videoId: string) => {
    setSelectedVideoId(videoId)
    window.history.pushState(null, "", `/video/${videoId}`)
  }, [])

  const handleDelete = useCallback(async () => {
    if (!selectedVideoId) return
    const videoId = selectedVideoId
    await fetch(`/api/videos/${videoId}`, { method: "DELETE" })
    await refresh()
  }, [selectedVideoId, refresh])

  // After refresh completes, if the selected video is gone, pick the next one
  useEffect(() => {
    if (!selectedVideoId || loading) return
    const stillExists = sortedVideos.some((v) => v.video_id === selectedVideoId)
    if (!stillExists) {
      if (sortedVideos.length > 0) {
        selectVideo(sortedVideos[0].video_id)
      } else {
        setSelectedVideoId(null)
        window.history.pushState(null, "", "/")
      }
    }
  }, [sortedVideos, selectedVideoId, loading, selectVideo])

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => setSelectedVideoId(getVideoIdFromPath())
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // Auto-select the latest video if no video in URL
  useEffect(() => {
    if (sortedVideos.length > 0 && selectedVideoId === null) {
      selectVideo(sortedVideos[0].video_id)
    }
  }, [sortedVideos, selectedVideoId, selectVideo])

  return (
    <ThemeProvider>
      <TooltipProvider>
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
              {detailLoading ? (
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
      </TooltipProvider>
    </ThemeProvider>
  )
}
