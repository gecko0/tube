import type { VideoSummary } from "@/lib/types"

export function buildRangeIds(
  anchorId: string,
  targetId: string,
  videos: VideoSummary[]
) {
  const anchorIndex = videos.findIndex((video) => video.videoId === anchorId)
  const targetIndex = videos.findIndex((video) => video.videoId === targetId)
  if (anchorIndex === -1 || targetIndex === -1) return [targetId]

  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  return videos.slice(start, end + 1).map((video) => video.videoId)
}
