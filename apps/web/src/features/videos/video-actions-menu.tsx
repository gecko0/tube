import { Archive, ArchiveRestore, Ellipsis, Eye, EyeOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { VideoDetail } from "@/lib/types"

export function VideoActionsMenu({
  detail,
  onArchiveToggle,
  onDelete,
  onReadToggle,
}: {
  detail: VideoDetail
  onArchiveToggle: () => void
  onDelete: () => void
  onReadToggle: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0 -mr-1">
          <Ellipsis className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onReadToggle}>
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
        <DropdownMenuItem onSelect={onArchiveToggle}>
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
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
