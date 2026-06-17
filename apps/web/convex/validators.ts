import { v } from "convex/values";

export const videoMetadataValidator = v.object({
  version: v.optional(v.number()),
  videoId: v.optional(v.string()),
  url: v.optional(v.string()),
  title: v.optional(v.string()),
  author: v.optional(v.string()),
  fetchedAt: v.optional(v.string()),
  aiEngine: v.optional(v.string()),
  model: v.optional(v.string()),
  briefSummaryGeneratedAt: v.optional(v.string()),
  summaryGeneratedAt: v.optional(v.string()),
});
