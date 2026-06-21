import { useCallback, useEffect, useState, type MouseEvent } from "react"
import { buildRangeIds } from "@/features/videos/lib/video-selection"
import type { VideoSummary } from "@/lib/types"

export function useVideoSelection({
  clearOpenVideo,
  videos,
}: {
  clearOpenVideo: () => void
  videos: VideoSummary[]
}) {
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    new Set()
  )
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null)
  const selectionActive = selectedVideoIds.size > 0

  const handleVideoSelect = useCallback((event: MouseEvent, videoId: string) => {
    event.preventDefault()
    clearOpenVideo()

    if (event.shiftKey && selectionAnchorId) {
      const rangeIds = buildRangeIds(selectionAnchorId, videoId, videos)
      setSelectedVideoIds(new Set(rangeIds))
      return
    }

    setSelectedVideoIds((current) => {
      const next = new Set(current)
      if (next.has(videoId)) {
        next.delete(videoId)
      } else {
        next.add(videoId)
      }
      setSelectionAnchorId(videoId)
      if (next.size === 0) {
        setSelectionAnchorId(null)
      }
      return next
    })
  }, [clearOpenVideo, selectionAnchorId, videos])

  const clearMultiSelection = useCallback(() => {
    setSelectedVideoIds(new Set())
    setSelectionAnchorId(null)
  }, [])

  const selectVideoIds = useCallback((videoIds: string[]) => {
    setSelectedVideoIds(new Set(videoIds))
    setSelectionAnchorId(videoIds[0] ?? null)
  }, [])

  const removeSelectedVideoId = useCallback((videoId: string) => {
    setSelectedVideoIds((current) => {
      const next = new Set(current)
      next.delete(videoId)
      return next
    })
  }, [])

  useEffect(() => {
    if (!selectionActive) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        clearMultiSelection()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [clearMultiSelection, selectionActive])

  return {
    selectedVideoIds,
    selectionActive,
    clearMultiSelection,
    handleVideoSelect,
    removeSelectedVideoId,
    selectVideoIds,
  }
}
