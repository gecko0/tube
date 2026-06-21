import { useMemo } from "react"
import { useMutation, usePaginatedQuery, useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import type { FolderScope } from "@/lib/types"

export function useVideosPageData({
  folderScope,
  selectedVideoId,
}: {
  folderScope: FolderScope
  selectedVideoId: string | null
}) {
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
  const videosList = useMemo(() => videos ? [...videos] : [], [videos])

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
  const mutations = useMemo(() => ({
    createFolder,
    renameFolder,
    removeFolder,
    moveToFolder,
    archiveVideo,
    archiveManyVideos,
    unarchiveVideo,
    removeVideo,
    markRead,
    markUnread,
  }), [
    archiveManyVideos,
    archiveVideo,
    createFolder,
    markRead,
    markUnread,
    moveToFolder,
    removeFolder,
    removeVideo,
    renameFolder,
    unarchiveVideo,
  ])

  return {
    folders,
    videos: videosList,
    detail,
    loading: videosStatus === "LoadingFirstPage",
    canLoadMoreVideos: videosStatus === "CanLoadMore",
    loadingMoreVideos: videosStatus === "LoadingMore",
    loadMoreVideos,
    mutations,
  }
}
