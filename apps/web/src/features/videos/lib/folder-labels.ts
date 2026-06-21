import type { FolderScope, FolderSummary } from "@/lib/types"

export function getFolderViewTitle(
  scope: FolderScope,
  folders: FolderSummary[]
) {
  if (scope.kind === "all") return "All videos"
  if (scope.kind === "inbox") return "Inbox"
  if (scope.kind === "archived") return "Archived"
  return folders.find((folder) => folder._id === scope.folderId)?.name ?? "Folder"
}

export function getFolderEmptyLabel(scope: FolderScope) {
  if (scope.kind === "all") return "No videos"
  if (scope.kind === "inbox") return "No videos in Inbox"
  if (scope.kind === "archived") return "No archived videos"
  return "No videos in this folder"
}
