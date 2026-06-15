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
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_videoId", ["userId", "videoId"]),

  apiKeys: defineTable({
    userId: v.string(),
    keyHash: v.string(),
    name: v.string(),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_userId", ["userId"]),
});
