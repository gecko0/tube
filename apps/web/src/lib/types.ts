import type { Id } from "../../convex/_generated/dataModel"

export type FolderScope =
  | { kind: "all" }
  | { kind: "inbox" }
  | { kind: "archived" }
  | { kind: "folder"; folderId: Id<"folders"> }

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
  folderId?: Id<"folders">
  date: string
  title: string
  hasSummary: boolean
  tags: string[]
  thumbnailUrl: string
  metadata: VideoMetadata | null
  archivedAt?: number
  readAt?: number
}

export interface VideoDetail {
  _id: Id<"videos">
  videoId: string
  folderId?: Id<"folders">
  date: string
  title: string
  summaryMd: string | null
  briefSummaryMd: string | null
  tags: string[]
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

export interface FolderSummary {
  _id: Id<"folders">
  _creationTime: number
  name: string
  parentFolderId?: Id<"folders">
  videoCount: number
}
