import { useEffect, useState } from "react"
import type { VideoDetail } from "@/lib/types"

export function useVideoDetail(videoId: string | null) {
  const [detail, setDetail] = useState<VideoDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!videoId) {
      setDetail(null)
      return
    }

    setLoading(true)
    fetch(`/api/videos/${videoId}`)
      .then((res) => res.json())
      .then((data) => {
        setDetail(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [videoId])

  return { detail, loading }
}
