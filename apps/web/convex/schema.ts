import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  videos: defineTable({
    userId: v.string(),
    videoId: v.string(),
    date: v.string(),
    title: v.string(),
    transcriptMd: v.string(),
    summaryMd: v.optional(v.string()),
    thumbnailUrl: v.string(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_videoId", ["userId", "videoId"])
    .index("by_userId_and_archivedAt", ["userId", "archivedAt"]),

  apiKeys: defineTable({
    userId: v.string(),
    keyHash: v.string(),
    name: v.string(),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_userId", ["userId"]),
});
