import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { videoMetadataValidator } from "./validators";

export default defineSchema({
  videos: defineTable({
    userId: v.string(),
    videoId: v.string(),
    folderId: v.optional(v.id("folders")),
    date: v.string(),
    title: v.string(),
    transcriptMd: v.string(),
    summaryMd: v.optional(v.string()),
    briefSummaryMd: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    thumbnailUrl: v.string(),
    metadata: v.optional(videoMetadataValidator),
    archivedAt: v.optional(v.number()),
    readAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_videoId", ["userId", "videoId"])
    .index("by_userId_and_archivedAt", ["userId", "archivedAt"])
    .index("by_userId_and_archivedAt_and_date", [
      "userId",
      "archivedAt",
      "date",
    ])
    .index("by_userId_and_folderId", ["userId", "folderId"])
    .index("by_userId_and_folderId_and_archivedAt", [
      "userId",
      "folderId",
      "archivedAt",
    ])
    .index("by_userId_and_folderId_and_archivedAt_and_date", [
      "userId",
      "folderId",
      "archivedAt",
      "date",
    ]),

  videoTags: defineTable({
    userId: v.string(),
    videoId: v.string(),
    tag: v.string(),
    folderId: v.optional(v.id("folders")),
    archivedAt: v.optional(v.number()),
    date: v.string(),
  })
    .index("by_userId_and_videoId", ["userId", "videoId"])
    .index("by_userId_and_tag_and_archivedAt_and_date", [
      "userId",
      "tag",
      "archivedAt",
      "date",
    ])
    .index("by_userId_and_tag_and_folderId_and_archivedAt_and_date", [
      "userId",
      "tag",
      "folderId",
      "archivedAt",
      "date",
    ]),

  folders: defineTable({
    userId: v.string(),
    name: v.string(),
    parentFolderId: v.optional(v.id("folders")),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_parentFolderId", ["userId", "parentFolderId"]),

  apiKeys: defineTable({
    userId: v.string(),
    keyHash: v.string(),
    name: v.string(),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_userId", ["userId"]),
});
