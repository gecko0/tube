export interface VideoSummary {
  date: string
  video_id: string
  title: string
  has_summary: boolean
  thumbnail_url: string
}

export interface VideoDetail {
  date: string
  video_id: string
  title: string
  summary_md: string | null
  transcript_md: string | null
  thumbnail_url: string
}
