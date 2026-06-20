import type { Id } from "../../convex/_generated/dataModel"

export type VideoView = "active" | "archived"

export interface VideoMetadata {
  version?: number
  videoId?: string
  url?: string
  title?: string
  author?: string
  fetchedAt?: string
  aiEngine?: string
  model?: string
  briefSummaryGeneratedAt?: string
  summaryGeneratedAt?: string
}

export interface VideoSummary {
  _id: Id<"videos">
  _creationTime: number
  videoId: string
  date: string
  title: string
  hasSummary: boolean
  thumbnailUrl: string
  metadata: VideoMetadata | null
  archivedAt?: number
  readAt?: number
}

export interface VideoDetail {
  _id: Id<"videos">
  videoId: string
  date: string
  title: string
  summaryMd: string | null
  briefSummaryMd: string | null
  transcriptMd: string
  thumbnailUrl: string
  metadata: VideoMetadata | null
  archivedAt?: number
  readAt?: number
}

export interface ApiKey {
  _id: Id<"apiKeys">
  _creationTime: number
  name: string
}
