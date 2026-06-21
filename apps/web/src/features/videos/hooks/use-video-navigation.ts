import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { getVideoIdFromPath } from "@/features/videos/lib/route-video-id"
import type { VideoDetail, VideoSummary } from "@/lib/types"

export function useVideoNavigation() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(
    getVideoIdFromPath
  )
  const suppressedAutoReadVideoId = useRef<string | null>(null)

  const clearOpenVideo = useCallback(() => {
    suppressedAutoReadVideoId.current = null
    setSelectedVideoId(null)
    window.history.pushState(null, "", "/")
  }, [])

  const selectVideo = useCallback((videoId: string) => {
    suppressedAutoReadVideoId.current = null
    setSelectedVideoId(videoId)
    window.history.pushState(null, "", `/video/${videoId}`)
  }, [])

  const selectNextVisibleVideo = useCallback((videoId: string, videos: VideoSummary[]) => {
    const currentIndex = videos.findIndex((video) => video.videoId === videoId)
    const fallback =
      videos[currentIndex + 1] ??
      videos[currentIndex - 1] ??
      videos.find((video) => video.videoId !== videoId)

    if (fallback && fallback.videoId !== videoId) {
      selectVideo(fallback.videoId)
    } else {
      clearOpenVideo()
    }
  }, [clearOpenVideo, selectVideo])

  const allowAutoRead = useCallback(() => {
    suppressedAutoReadVideoId.current = null
  }, [])

  const suppressAutoRead = useCallback((videoId: string) => {
    suppressedAutoReadVideoId.current = videoId
  }, [])

  useEffect(() => {
    const onPopState = () => {
      suppressedAutoReadVideoId.current = null
      setSelectedVideoId(getVideoIdFromPath())
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  return {
    selectedVideoId,
    clearOpenVideo,
    selectVideo,
    selectNextVisibleVideo,
    allowAutoRead,
    suppressAutoRead,
    suppressedAutoReadVideoId,
  }
}

export function useVideoNavigationEffects({
  clearOpenVideo,
  detail,
  loading,
  markRead,
  selectedVideoId,
  selectVideo,
  suppressedAutoReadVideoId,
  videos,
}: {
  clearOpenVideo: () => void
  detail: VideoDetail | null | undefined
  loading: boolean
  markRead: (args: { videoId: string }) => Promise<unknown>
  selectedVideoId: string | null
  selectVideo: (videoId: string) => void
  suppressedAutoReadVideoId: RefObject<string | null>
  videos: VideoSummary[]
}) {
  useEffect(() => {
    if (!selectedVideoId || !detail || detail.readAt !== undefined) return
    if (suppressedAutoReadVideoId.current === selectedVideoId) return

    void markRead({ videoId: selectedVideoId })
  }, [detail, markRead, selectedVideoId, suppressedAutoReadVideoId])

  useEffect(() => {
    if (!selectedVideoId || loading || detail === undefined) return
    const stillExists = videos.some((video) => video.videoId === selectedVideoId)
    if (!stillExists && detail === null) {
      if (videos.length > 0) {
        selectVideo(videos[0].videoId)
      } else {
        clearOpenVideo()
      }
    }
  }, [clearOpenVideo, detail, loading, selectVideo, selectedVideoId, videos])
}
