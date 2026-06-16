import type { Id } from "../../convex/_generated/dataModel"

export type VideoView = "active" | "archived"

export interface VideoSummary {
  _id: Id<"videos">
  _creationTime: number
  videoId: string
  date: string
  title: string
  hasSummary: boolean
  thumbnailUrl: string
  archivedAt?: number
}

export interface VideoDetail {
  _id: Id<"videos">
  videoId: string
  date: string
  title: string
  summaryMd: string | null
  transcriptMd: string
  thumbnailUrl: string
  archivedAt?: number
}

export interface ApiKey {
  _id: Id<"apiKeys">
  _creationTime: number
  name: string
}
