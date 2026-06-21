import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from "react"
import { RedirectToSignIn, useAuth } from "@clerk/react"
import {
  useMutation,
  useConvexAuth,
  useQuery,
  usePaginatedQuery,
} from "convex/react"
import { api } from "../convex/_generated/api"
import { Archive, ArchiveRestore, Ellipsis, Eye, EyeOff, Trash2 } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { FolderFormDialog } from "@/components/folder-form-dialog"
import { ThemeProvider } from "@/components/theme-provider"
import { VideoDetail } from "@/components/video-detail"
import { VideoGrid } from "@/components/video-grid"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { useDialog, useDialogWithData } from "@/hooks/use-dialog"
import type { Id } from "../convex/_generated/dataModel"
import type { FolderScope, FolderSummary, VideoSummary } from "@/lib/types"

const VIDEO_DRAG_TYPE = "application/x-tube-video-ids"
type VideoDropTarget = "inbox" | "archived" | Id<"folders">

function getVideoIdFromPath() {
  const match = window.location.pathname.match(/^\/video\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

function getFolderViewTitle(scope: FolderScope, folders: FolderSummary[]) {
  if (scope.kind === "all") return "All videos"
  if (scope.kind === "inbox") return "Inbox"
  if (scope.kind === "archived") return "Archived"
  return folders.find((folder) => folder._id === scope.folderId)?.name ?? "Folder"
}

function getFolderEmptyLabel(scope: FolderScope) {
  if (scope.kind === "all") return "No videos"
  if (scope.kind === "inbox") return "No videos in Inbox"
  if (scope.kind === "archived") return "No archived videos"
  return "No videos in this folder"
}

function buildRangeIds(anchorId: string, targetId: string, videos: VideoSummary[]) {
  const anchorIndex = videos.findIndex((video) => video.videoId === anchorId)
  const targetIndex = videos.findIndex((video) => video.videoId === targetId)
  if (anchorIndex === -1 || targetIndex === -1) return [targetId]

  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  return videos.slice(start, end + 1).map((video) => video.videoId)
}

function AuthenticatedApp() {
  const [folderScope, setFolderScope] = useState<FolderScope>({ kind: "all" })
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(getVideoIdFromPath)
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set())
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null)
  const [draggingVideoIds, setDraggingVideoIds] = useState<string[]>([])
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null)
  const suppressedAutoReadVideoId = useRef<string | null>(null)
  const videoDeleteDialog = useDialog()
  const folderFormDialog = useDialogWithData<FolderSummary>()
  const folderDeleteDialog = useDialogWithData<FolderSummary>()

  const foldersQuery = useQuery(api.folders.list)
  const folders = useMemo(() => foldersQuery ?? [], [foldersQuery])

  const {
    results: videos,
    status: videosStatus,
    loadMore: loadMoreVideos,
  } = usePaginatedQuery(
    api.videos.listPage,
    { folderScope },
    { initialNumItems: 100 }
  )
  const detail = useQuery(
    api.videos.get,
    selectedVideoId ? { videoId: selectedVideoId } : "skip"
  )

  const createFolder = useMutation(api.folders.create)
  const renameFolder = useMutation(api.folders.rename)
  const removeFolder = useMutation(api.folders.remove)
  const moveToFolder = useMutation(api.videos.moveToFolder)
  const archiveVideo = useMutation(api.videos.archive)
  const archiveManyVideos = useMutation(api.videos.archiveMany)
  const unarchiveVideo = useMutation(api.videos.unarchive)
  const removeVideo = useMutation(api.videos.remove)
  const markRead = useMutation(api.videos.markRead)
  const markUnread = useMutation(api.videos.markUnread)

  const loading = videosStatus === "LoadingFirstPage"
  const canLoadMoreVideos = videosStatus === "CanLoadMore"
  const loadingMoreVideos = videosStatus === "LoadingMore"
  const sortedVideos = useMemo(() => videos ? [...videos] : [], [videos])
  const folderViewTitle = getFolderViewTitle(folderScope, folders)
  const folderDeleteTarget = folderDeleteDialog.data
  const selectionActive = selectedVideoIds.size > 0

  const loadMoreNextVideos = useCallback(() => {
    loadMoreVideos(100)
  }, [loadMoreVideos])

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

  const handleVideoSelect = useCallback((event: MouseEvent, videoId: string) => {
    event.preventDefault()
    clearOpenVideo()

    if (event.shiftKey && selectionAnchorId) {
      const rangeIds = buildRangeIds(selectionAnchorId, videoId, sortedVideos)
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
  }, [clearOpenVideo, selectionAnchorId, sortedVideos])

  const clearMultiSelection = useCallback(() => {
    setSelectedVideoIds(new Set())
    setSelectionAnchorId(null)
  }, [])

  const handleFolderScopeChange = useCallback((scope: FolderScope) => {
    setFolderScope(scope)
    clearMultiSelection()
    clearOpenVideo()
  }, [clearMultiSelection, clearOpenVideo])

  const handleMoveSelectionToInbox = useCallback(async () => {
    const videoIds = Array.from(selectedVideoIds)
    if (videoIds.length === 0) return

    await moveToFolder({ videoIds, folderId: null })
    clearMultiSelection()
  }, [clearMultiSelection, moveToFolder, selectedVideoIds])

  const selectNextVisibleVideo = useCallback((videoId: string) => {
    const currentIndex = sortedVideos.findIndex((video) => video.videoId === videoId)
    const fallback =
      sortedVideos[currentIndex + 1] ??
      sortedVideos[currentIndex - 1] ??
      sortedVideos.find((video) => video.videoId !== videoId)

    if (fallback && fallback.videoId !== videoId) {
      selectVideo(fallback.videoId)
    } else {
      clearOpenVideo()
    }
  }, [clearOpenVideo, selectVideo, sortedVideos])

  const handleArchiveToggle = useCallback(async () => {
    if (!selectedVideoId || !detail) return

    if (detail.archivedAt === undefined) {
      await archiveVideo({ videoId: selectedVideoId })
    } else {
      await unarchiveVideo({ videoId: selectedVideoId })
    }
    selectNextVisibleVideo(selectedVideoId)
  }, [archiveVideo, detail, selectedVideoId, selectNextVisibleVideo, unarchiveVideo])

  const handleReadToggle = useCallback(async () => {
    if (!selectedVideoId || !detail) return

    if (detail.readAt === undefined) {
      suppressedAutoReadVideoId.current = null
      await markRead({ videoId: selectedVideoId })
    } else {
      suppressedAutoReadVideoId.current = selectedVideoId
      await markUnread({ videoId: selectedVideoId })
    }
  }, [detail, markRead, markUnread, selectedVideoId])

  const handleDeleteVideo = useCallback(async () => {
    if (!selectedVideoId) return
    await removeVideo({ videoId: selectedVideoId })
    setSelectedVideoIds((current) => {
      const next = new Set(current)
      next.delete(selectedVideoId)
      return next
    })
    selectNextVisibleVideo(selectedVideoId)
  }, [selectedVideoId, removeVideo, selectNextVisibleVideo])

  const handleSubmitFolderForm = useCallback(async ({ name }: { name: string }) => {
    const folder = folderFormDialog.data
    if (folder) {
      await renameFolder({ folderId: folder._id, name })
      return
    }

    const folderId = await createFolder({ name })
    setFolderScope({ kind: "folder", folderId })
    clearMultiSelection()
    clearOpenVideo()
  }, [
    clearMultiSelection,
    clearOpenVideo,
    createFolder,
    folderFormDialog.data,
    renameFolder,
  ])

  const handleDeleteFolder = useCallback((folder: FolderSummary) => {
    folderDeleteDialog.open(folder)
  }, [folderDeleteDialog])

  const handleConfirmDeleteFolder = useCallback(async () => {
    const folderDeleteTarget = folderDeleteDialog.data
    if (!folderDeleteTarget) return
    await removeFolder({
      folderId: folderDeleteTarget._id,
      archiveContainedVideos: true,
    })

    if (folderScope.kind === "folder" && folderScope.folderId === folderDeleteTarget._id) {
      setFolderScope({ kind: "inbox" })
      clearOpenVideo()
    }
    if (detail?.folderId === folderDeleteTarget._id) {
      clearOpenVideo()
    }
    clearMultiSelection()
    folderDeleteDialog.close()
  }, [
    clearMultiSelection,
    clearOpenVideo,
    detail,
    folderDeleteDialog,
    folderScope,
    removeFolder,
  ])

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
      setSelectedVideoIds(new Set(videoIds))
      setSelectionAnchorId(videoIds[0] ?? null)
    }

    setDraggingVideoIds([])
    setDropTargetKey(null)
  }, [archiveManyVideos, draggingVideoIds, moveToFolder])

  useEffect(() => {
    if (!selectedVideoId || !detail || detail.readAt !== undefined) return
    if (suppressedAutoReadVideoId.current === selectedVideoId) return

    void markRead({ videoId: selectedVideoId })
  }, [detail, markRead, selectedVideoId])

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

  // After videos update, if the selected video is gone, pick the next visible one.
  useEffect(() => {
    if (!selectedVideoId || loading || detail === undefined) return
    const stillExists = sortedVideos.some((v) => v.videoId === selectedVideoId)
    if (!stillExists && detail === null) {
      if (sortedVideos.length > 0) {
        selectVideo(sortedVideos[0].videoId)
      } else {
        setSelectedVideoId(null)
        window.history.pushState(null, "", "/")
      }
    }
  }, [sortedVideos, selectedVideoId, loading, detail, selectVideo])

  // Handle browser back/forward.
  useEffect(() => {
    const onPopState = () => {
      suppressedAutoReadVideoId.current = null
      setSelectedVideoId(getVideoIdFromPath())
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar
        folders={folders}
        folderScope={folderScope}
        dropTargetKey={dropTargetKey}
        onFolderScopeChange={handleFolderScopeChange}
        onCreateFolder={() => folderFormDialog.open()}
        onRenameFolder={(folder) => folderFormDialog.open(folder)}
        onDeleteFolder={handleDeleteFolder}
        onFolderDragOver={handleFolderDragOver}
        onFolderDragLeave={handleFolderDragLeave}
        onFolderDrop={handleFolderDrop}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 overflow-hidden border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {detail ? detail.title : folderViewTitle}
          </span>
          {!selectionActive && detail && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 -mr-1">
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={handleReadToggle}>
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
                <DropdownMenuItem onSelect={handleArchiveToggle}>
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
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={videoDeleteDialog.open}
                >
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        {detail && (
          <AlertDialog {...videoDeleteDialog.props}>
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
                <AlertDialogAction variant="destructive" onClick={handleDeleteVideo}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <AlertDialog
          {...folderDeleteDialog.props}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this folder?</AlertDialogTitle>
              <AlertDialogDescription>
                {(folderDeleteTarget?.videoCount ?? 0) === 0
                  ? "This will delete the folder."
                  : (
                    <>
                      This folder contains {folderDeleteTarget?.videoCount ?? 0}{" "}
                      {(folderDeleteTarget?.videoCount ?? 0) === 1
                        ? "video"
                        : "videos"}
                      . Contained active videos will be archived, already archived
                      videos will stay archived, and folder info will be removed.
                    </>
                  )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleConfirmDeleteFolder}
              >
                {(folderDeleteTarget?.videoCount ?? 0) === 0
                  ? "Delete folder"
                  : "Archive videos and delete folder"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <FolderFormDialog
          {...folderFormDialog.props}
          folder={folderFormDialog.data}
          onSubmit={handleSubmitFolderForm}
        />
        <main className="flex-1 overflow-auto">
          {detail === undefined && selectedVideoId ? (
            <div className="flex h-64 items-center justify-center">
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : detail ? (
            <VideoDetail detail={detail} />
          ) : (
            <VideoGrid
              title={folderViewTitle}
              videos={sortedVideos}
              loading={loading}
              emptyLabel={getFolderEmptyLabel(folderScope)}
              selectedVideoIds={selectedVideoIds}
              draggingVideoIds={draggingVideoIds}
              canLoadMore={canLoadMoreVideos}
              loadingMore={loadingMoreVideos}
              canMoveSelectionToInbox={folderScope.kind !== "inbox"}
              onLoadMore={loadMoreNextVideos}
              onMoveSelectionToInbox={handleMoveSelectionToInbox}
              onCancelSelection={clearMultiSelection}
              onVideoOpen={selectVideo}
              onVideoSelect={handleVideoSelect}
              onVideoDragStart={handleVideoDragStart}
              onVideoDragEnd={handleVideoDragEnd}
            />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AuthStatus({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <span className="text-sm text-muted-foreground">{children}</span>
    </div>
  )
}

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth()
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (!isLoaded || (isSignedIn && isLoading)) {
    return <AuthStatus>Loading...</AuthStatus>
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />
  }

  if (isAuthenticated) {
    return <AuthenticatedApp />
  }

  return (
    <AuthStatus>
      Unable to authenticate with Convex. Check the Clerk Convex integration and
      CLERK_JWT_ISSUER_DOMAIN setting.
    </AuthStatus>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <AuthGate />
      </TooltipProvider>
    </ThemeProvider>
  )
}
