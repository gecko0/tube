import { useCallback, useEffect, useMemo, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { VideoDetail } from "@/components/video-detail"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useVideoDetail } from "@/hooks/use-video-detail"
import { useVideos } from "@/hooks/use-videos"

function getVideoIdFromPath() {
  const match = window.location.pathname.match(/^\/video\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export default function App() {
  const { videos, loading } = useVideos()
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(getVideoIdFromPath)
  const { detail, loading: detailLoading } = useVideoDetail(selectedVideoId)

  const sortedVideos = useMemo(() => [...videos].reverse(), [videos])

  const selectVideo = useCallback((videoId: string) => {
    setSelectedVideoId(videoId)
    window.history.pushState(null, "", `/video/${videoId}`)
  }, [])

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
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 !h-4" />
              <span className="text-sm font-medium truncate">
                {detail ? detail.title : "yt — YouTube Transcripts"}
              </span>
            </header>
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
