import { useCallback, useEffect, useState } from "react"
import type { VideoSummary } from "@/lib/types"

export function useVideos() {
  const [videos, setVideos] = useState<VideoSummary[]>([])
  const [loading, setLoading] = useState(true)

  const fetchVideos = useCallback(() => {
    return fetch("/api/videos")
      .then((res) => res.json())
      .then((data) => {
        setVideos(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  return { videos, loading, refresh: fetchVideos }
}
