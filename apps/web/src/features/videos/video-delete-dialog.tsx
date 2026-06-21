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
import type { useDialog } from "@/hooks/use-dialog"
import type { VideoDetail } from "@/lib/types"

export function VideoDeleteDialog({
  detail,
  dialog,
  onDeleteVideo,
}: {
  detail: VideoDetail | null
  dialog: ReturnType<typeof useDialog>
  onDeleteVideo: () => void
}) {
  if (!detail) return null

  return (
    <AlertDialog {...dialog.props}>
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
          <AlertDialogAction variant="destructive" onClick={onDeleteVideo}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
