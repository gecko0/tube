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
import type { useDialogWithData } from "@/hooks/use-dialog"
import type { FolderSummary } from "@/lib/types"

export function FolderDeleteDialog({
  dialog,
  folder,
  onConfirmDeleteFolder,
}: {
  dialog: ReturnType<typeof useDialogWithData<FolderSummary>>
  folder: FolderSummary | null
  onConfirmDeleteFolder: () => void
}) {
  const videoCount = folder?.videoCount ?? 0

  return (
    <AlertDialog {...dialog.props}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this folder?</AlertDialogTitle>
          <AlertDialogDescription>
            {videoCount === 0
              ? "This will delete the folder."
              : (
                <>
                  This folder contains {videoCount}{" "}
                  {videoCount === 1 ? "video" : "videos"}. Contained active
                  videos will be archived, already archived videos will stay
                  archived, and folder info will be removed.
                </>
              )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirmDeleteFolder}
          >
            {videoCount === 0
              ? "Delete folder"
              : "Archive videos and delete folder"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
