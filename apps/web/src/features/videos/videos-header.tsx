import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { VideoActionsMenu } from "@/features/videos/video-actions-menu"
import type { VideoDetail } from "@/lib/types"

export function VideosHeader({
  detail,
  fallbackTitle,
  selectionActive,
  onArchiveToggle,
  onDeleteVideo,
  onReadToggle,
}: {
  detail: VideoDetail | null | undefined
  fallbackTitle: string
  selectionActive: boolean
  onArchiveToggle: () => void
  onDeleteVideo: () => void
  onReadToggle: () => void
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 overflow-hidden border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {detail ? detail.title : fallbackTitle}
      </span>
      {!selectionActive && detail && (
        <VideoActionsMenu
          detail={detail}
          onArchiveToggle={onArchiveToggle}
          onDelete={onDeleteVideo}
          onReadToggle={onReadToggle}
        />
      )}
    </header>
  )
}
