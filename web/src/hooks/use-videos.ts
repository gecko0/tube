import { useEffect, useState } from "react"
import type { VideoSummary } from "@/lib/types"

export function useVideos() {
  const [videos, setVideos] = useState<VideoSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/videos")
      .then((res) => res.json())
      .then((data) => {
        setVideos(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { videos, loading }
}
