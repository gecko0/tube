import { useCallback, useState } from "react"
import { FolderFormDialog } from "@/components/folder-form-dialog"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/features/videos/components/app-sidebar"
import { VideoDetail } from "@/features/videos/components/video-detail"
import { VideoGrid } from "@/features/videos/components/video-grid"
import { FolderDeleteDialog } from "@/features/videos/folder-delete-dialog"
import { useVideoDragDrop } from "@/features/videos/hooks/use-video-drag-drop"
import {
  useVideoNavigation,
  useVideoNavigationEffects,
} from "@/features/videos/hooks/use-video-navigation"
import { useVideoSelection } from "@/features/videos/hooks/use-video-selection"
import { useVideosPageData } from "@/features/videos/hooks/use-videos-page-data"
import {
  getFolderEmptyLabel,
  getFolderViewTitle,
} from "@/features/videos/lib/folder-labels"
import { VideoDeleteDialog } from "@/features/videos/video-delete-dialog"
import { VideosHeader } from "@/features/videos/videos-header"
import { useDialog, useDialogWithData } from "@/hooks/use-dialog"
import type { FolderScope, FolderSummary } from "@/lib/types"

export function VideosPage() {
  const [folderScope, setFolderScope] = useState<FolderScope>({ kind: "all" })
  const [tagFilter, setTagFilter] = useState("")
  const videoDeleteDialog = useDialog()
  const folderFormDialog = useDialogWithData<FolderSummary>()
  const folderDeleteDialog = useDialogWithData<FolderSummary>()
  const navigation = useVideoNavigation()
  const {
    allowAutoRead,
    clearOpenVideo,
    selectNextVisibleVideo,
    selectVideo,
    selectedVideoId,
    suppressAutoRead,
    suppressedAutoReadVideoId,
  } = navigation

  const {
    canLoadMoreVideos,
    detail,
    folders,
    loading,
    loadingMoreVideos,
    loadMoreVideos,
    mutations,
    videos,
  } = useVideosPageData({
    folderScope,
    selectedVideoId,
    tagFilter,
  })
  const {
    archiveManyVideos,
    archiveVideo,
    createFolder,
    markRead,
    markUnread,
    moveToFolder,
    removeFolder,
    removeVideo,
    renameFolder,
    setTags,
    unarchiveVideo,
  } = mutations

  useVideoNavigationEffects({
    clearOpenVideo,
    detail,
    loading,
    markRead,
    selectedVideoId,
    selectVideo,
    suppressedAutoReadVideoId,
    videos,
  })

  const {
    clearMultiSelection,
    handleVideoSelect,
    removeSelectedVideoId,
    selectedVideoIds,
    selectVideoIds,
    selectionActive,
  } = useVideoSelection({
    clearOpenVideo,
    videos,
  })

  const {
    draggingVideoIds,
    dropTargetKey,
    handleFolderDragLeave,
    handleFolderDragOver,
    handleFolderDrop,
    handleVideoDragEnd,
    handleVideoDragStart,
  } = useVideoDragDrop({
    archiveManyVideos,
    moveToFolder,
    onDroppedVideos: selectVideoIds,
    selectedVideoIds,
  })

  const folderViewTitle = getFolderViewTitle(folderScope, folders)
  const folderDeleteTarget = folderDeleteDialog.data ?? null

  const handleFolderScopeChange = useCallback((scope: FolderScope) => {
    setFolderScope(scope)
    clearMultiSelection()
    clearOpenVideo()
  }, [clearMultiSelection, clearOpenVideo])

  const handleTagFilterChange = useCallback((tag: string) => {
    setTagFilter(tag)
    clearMultiSelection()
    clearOpenVideo()
  }, [clearMultiSelection, clearOpenVideo])

  const handleMoveSelectionToInbox = useCallback(async () => {
    const videoIds = Array.from(selectedVideoIds)
    if (videoIds.length === 0) return

    await moveToFolder({ videoIds, folderId: null })
    clearMultiSelection()
  }, [clearMultiSelection, moveToFolder, selectedVideoIds])

  const handleArchiveToggle = useCallback(async () => {
    if (!selectedVideoId || !detail) return

    if (detail.archivedAt === undefined) {
      await archiveVideo({ videoId: selectedVideoId })
    } else {
      await unarchiveVideo({ videoId: selectedVideoId })
    }
    selectNextVisibleVideo(selectedVideoId, videos)
  }, [archiveVideo, detail, selectedVideoId, selectNextVisibleVideo, unarchiveVideo, videos])

  const handleReadToggle = useCallback(async () => {
    if (!selectedVideoId || !detail) return

    if (detail.readAt === undefined) {
      allowAutoRead()
      await markRead({ videoId: selectedVideoId })
    } else {
      suppressAutoRead(selectedVideoId)
      await markUnread({ videoId: selectedVideoId })
    }
  }, [allowAutoRead, detail, markRead, markUnread, selectedVideoId, suppressAutoRead])

  const handleDeleteVideo = useCallback(async () => {
    if (!selectedVideoId) return
    await removeVideo({ videoId: selectedVideoId })
    removeSelectedVideoId(selectedVideoId)
    selectNextVisibleVideo(selectedVideoId, videos)
  }, [removeSelectedVideoId, removeVideo, selectedVideoId, selectNextVisibleVideo, videos])

  const handleSubmitTags = useCallback(async (tags: string[]) => {
    if (!selectedVideoId) return
    await setTags({ videoId: selectedVideoId, tags })
  }, [selectedVideoId, setTags])

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
  }, [clearMultiSelection, clearOpenVideo, createFolder, folderFormDialog.data, renameFolder])

  const handleDeleteFolder = useCallback((folder: FolderSummary) => {
    folderDeleteDialog.open(folder)
  }, [folderDeleteDialog])

  const handleConfirmDeleteFolder = useCallback(async () => {
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
    folderDeleteTarget,
    folderScope,
    removeFolder,
  ])

  const loadMoreNextVideos = useCallback(() => {
    loadMoreVideos(100)
  }, [loadMoreVideos])

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
        <VideosHeader />
        <VideoDeleteDialog
          detail={detail ?? null}
          dialog={videoDeleteDialog}
          onDeleteVideo={handleDeleteVideo}
        />
        <FolderDeleteDialog
          dialog={folderDeleteDialog}
          folder={folderDeleteTarget}
          onConfirmDeleteFolder={handleConfirmDeleteFolder}
        />
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
            <VideoDetail
              detail={detail}
              showActions={!selectionActive}
              onArchiveToggle={handleArchiveToggle}
              onDeleteVideo={videoDeleteDialog.open}
              onReadToggle={handleReadToggle}
              onTagsChange={handleSubmitTags}
            />
          ) : (
            <VideoGrid
              title={folderViewTitle}
              videos={videos}
              loading={loading}
              emptyLabel={getFolderEmptyLabel(folderScope)}
              selectedVideoIds={selectedVideoIds}
              draggingVideoIds={draggingVideoIds}
              canLoadMore={canLoadMoreVideos}
              loadingMore={loadingMoreVideos}
              canMoveSelectionToInbox={folderScope.kind !== "inbox"}
              tagFilter={tagFilter}
              onLoadMore={loadMoreNextVideos}
              onMoveSelectionToInbox={handleMoveSelectionToInbox}
              onCancelSelection={clearMultiSelection}
              onTagFilterChange={handleTagFilterChange}
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
