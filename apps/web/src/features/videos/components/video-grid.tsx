import { Check, PlayCircle, Search, X } from "lucide-react"
import type { DragEvent, MouseEvent } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn, formatDate } from "@/lib/utils"
import type { VideoSummary } from "@/lib/types"

interface VideoGridProps {
  title: string
  videos: VideoSummary[]
  loading: boolean
  emptyLabel: string
  selectedVideoIds: Set<string>
  draggingVideoIds: string[]
  canLoadMore: boolean
  loadingMore: boolean
  canMoveSelectionToInbox: boolean
  tagFilter: string
  onLoadMore: () => void
  onMoveSelectionToInbox: () => void
  onCancelSelection: () => void
  onTagFilterChange: (tag: string) => void
  onVideoOpen: (videoId: string) => void
  onVideoSelect: (event: MouseEvent, videoId: string) => void
  onVideoDragStart: (event: DragEvent, videoId: string) => void
  onVideoDragEnd: () => void
}

function setDragPreview(
  event: DragEvent,
  thumbnailUrl: string,
  count: number
) {
  const preview = document.createElement("div")
  const stackSize = Math.min(count, 3)
  preview.style.position = "fixed"
  preview.style.left = "-1000px"
  preview.style.top = "-1000px"
  preview.style.width = "168px"
  preview.style.height = "96px"
  preview.style.pointerEvents = "none"

  for (let index = stackSize - 1; index >= 0; index -= 1) {
    const layer = document.createElement("div")
    layer.style.position = "absolute"
    layer.style.inset = "0"
    layer.style.borderRadius = "8px"
    layer.style.overflow = "hidden"
    layer.style.backgroundImage = `url(${JSON.stringify(thumbnailUrl)})`
    layer.style.backgroundPosition = "center"
    layer.style.backgroundSize = "cover"
    layer.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.22)"
    layer.style.transform = `translate(${index * 6}px, ${index * 5}px)`
    layer.style.border = "1px solid rgba(255, 255, 255, 0.8)"
    preview.appendChild(layer)
  }

  if (count > 1) {
    const badge = document.createElement("div")
    badge.textContent = String(count)
    badge.style.position = "absolute"
    badge.style.right = "-14px"
    badge.style.top = "-12px"
    badge.style.minWidth = "28px"
    badge.style.height = "28px"
    badge.style.borderRadius = "999px"
    badge.style.background = "black"
    badge.style.color = "white"
    badge.style.display = "flex"
    badge.style.alignItems = "center"
    badge.style.justifyContent = "center"
    badge.style.font = "600 13px system-ui, sans-serif"
    badge.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.28)"
    preview.appendChild(badge)
  }

  document.body.appendChild(preview)
  event.dataTransfer.setDragImage(preview, 84, 48)
  window.setTimeout(() => preview.remove(), 0)
}

export function VideoGrid({
  title,
  videos,
  loading,
  emptyLabel,
  selectedVideoIds,
  draggingVideoIds,
  canLoadMore,
  loadingMore,
  canMoveSelectionToInbox,
  tagFilter,
  onLoadMore,
  onMoveSelectionToInbox,
  onCancelSelection,
  onTagFilterChange,
  onVideoOpen,
  onVideoSelect,
  onVideoDragStart,
  onVideoDragEnd,
}: VideoGridProps) {
  const selectionCount = selectedVideoIds.size
  const selectionActive = selectionCount > 0

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex min-h-8 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="truncate text-xl font-semibold">{title}</h1>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={tagFilter}
              onChange={(event) => onTagFilterChange(event.target.value)}
              placeholder="Filter by tag"
              className="h-9 pl-8 pr-9"
            />
            {tagFilter && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => onTagFilterChange("")}
              >
                <X className="size-4" />
                <span className="sr-only">Clear tag filter</span>
              </Button>
            )}
          </div>
          {selectionActive && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectionCount} selected
              </span>
              {canMoveSelectionToInbox && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onMoveSelectionToInbox}
                >
                  Move to Inbox
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onCancelSelection}>
                Cancel selection
              </Button>
            </>
          )}
          <span className="text-sm text-muted-foreground">
            {videos.length} {videos.length === 1 ? "video" : "videos"}
          </span>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-md border border-dashed">
          <span className="text-sm text-muted-foreground">{emptyLabel}</span>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-7">
          {videos.map((video) => {
            const selected = selectedVideoIds.has(video.videoId)
            const dragging = draggingVideoIds.includes(video.videoId)
            const dragVideoIds = selected && selectedVideoIds.size > 1
              ? videos
                .filter((candidate) => selectedVideoIds.has(candidate.videoId))
                .map((candidate) => candidate.videoId)
              : [video.videoId]
            const dragPreviewVideo =
              videos.find((candidate) => candidate.videoId === dragVideoIds[0])
              ?? video
            return (
              <div
                key={video.videoId}
                draggable
                onDragStart={(event) => {
                  setDragPreview(
                    event,
                    dragPreviewVideo.thumbnailUrl,
                    dragVideoIds.length
                  )
                  onVideoDragStart(event, video.videoId)
                }}
                onDragEnd={onVideoDragEnd}
                className={cn(
                  "group relative min-w-0 rounded-lg border border-transparent p-1 transition",
                  selected && "border-primary bg-primary/5 shadow-sm",
                  dragging && "opacity-50"
                )}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    if (selectionActive) {
                      onVideoSelect(event, video.videoId)
                      return
                    }
                    onVideoOpen(video.videoId)
                  }}
                  className="block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="size-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 hidden items-center justify-center bg-black/20 text-white group-hover:flex">
                      <PlayCircle className="size-9" />
                    </div>
                    {video.readAt === undefined && (
                      <span
                        className="absolute right-2 top-2 size-2 rounded-full bg-[oklch(0.5_0.16_250)] ring-2 ring-background dark:bg-[oklch(0.78_0.13_235)]"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="mt-2 flex min-w-0 flex-col gap-1">
                    <span
                      className={cn(
                        "line-clamp-2 text-sm leading-snug",
                        video.readAt === undefined
                          ? "font-semibold text-[oklch(0.43_0.16_250)] dark:text-[oklch(0.82_0.13_235)]"
                          : "font-medium"
                      )}
                    >
                      {video.title}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(video.date)}</span>
                      {video.archivedAt !== undefined && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          Archived
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={selected ? "Deselect video" : "Select video"}
                  aria-pressed={selected}
                  onClick={(event) => {
                    event.stopPropagation()
                    onVideoSelect(event, video.videoId)
                  }}
                  className={cn(
                    "absolute left-3 top-3 z-10 inline-flex size-7 items-center justify-center rounded-sm border border-black bg-background/95 text-foreground shadow-sm transition-opacity hover:bg-background focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white",
                    selectionActive || selected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  )}
                >
                  {selected && <Check className="size-4" />}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {canLoadMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  )
}
