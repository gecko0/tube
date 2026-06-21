import { useCallback, useState, type DragEvent } from "react"
import type { Id } from "../../../../convex/_generated/dataModel"
import {
  VIDEO_DRAG_TYPE,
  type VideoDropTarget,
} from "@/features/videos/types"

export function useVideoDragDrop({
  archiveManyVideos,
  moveToFolder,
  onDroppedVideos,
  selectedVideoIds,
}: {
  archiveManyVideos: (args: { videoIds: string[] }) => Promise<unknown>
  moveToFolder: (
    args: { videoIds: string[]; folderId: Id<"folders"> | null }
  ) => Promise<unknown>
  onDroppedVideos: (videoIds: string[]) => void
  selectedVideoIds: Set<string>
}) {
  const [draggingVideoIds, setDraggingVideoIds] = useState<string[]>([])
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null)

  const getDragVideoIds = useCallback((videoId: string) => {
    if (selectedVideoIds.has(videoId) && selectedVideoIds.size > 1) {
      return Array.from(selectedVideoIds)
    }
    return [videoId]
  }, [selectedVideoIds])

  const handleVideoDragStart = useCallback((event: DragEvent, videoId: string) => {
    const videoIds = getDragVideoIds(videoId)
    setDraggingVideoIds(videoIds)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData(VIDEO_DRAG_TYPE, JSON.stringify(videoIds))
    event.dataTransfer.setData("text/plain", videoIds.join(", "))
  }, [getDragVideoIds])

  const handleVideoDragEnd = useCallback(() => {
    setDraggingVideoIds([])
    setDropTargetKey(null)
  }, [])

  const handleFolderDragOver = useCallback((
    event: DragEvent,
    target: VideoDropTarget
  ) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDropTargetKey(target)
  }, [])

  const handleFolderDragLeave = useCallback(() => {
    setDropTargetKey(null)
  }, [])

  const handleFolderDrop = useCallback(async (
    event: DragEvent,
    target: VideoDropTarget
  ) => {
    event.preventDefault()
    const rawPayload = event.dataTransfer.getData(VIDEO_DRAG_TYPE)
    const videoIds = rawPayload
      ? JSON.parse(rawPayload) as string[]
      : draggingVideoIds

    if (videoIds.length > 0) {
      if (target === "archived") {
        await archiveManyVideos({ videoIds })
      } else {
        await moveToFolder({
          videoIds,
          folderId: target === "inbox" ? null : target,
        })
      }
      onDroppedVideos(videoIds)
    }

    setDraggingVideoIds([])
    setDropTargetKey(null)
  }, [archiveManyVideos, draggingVideoIds, moveToFolder, onDroppedVideos])

  return {
    draggingVideoIds,
    dropTargetKey,
    handleFolderDragLeave,
    handleFolderDragOver,
    handleFolderDrop,
    handleVideoDragEnd,
    handleVideoDragStart,
  }
}
