import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { videoMetadataValidator } from "./validators";

export const resolveApiKey = internalQuery({
  args: { keyHash: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
      .unique();
    return key ? key.userId : null;
  },
});

export const findMissingVideoIds = internalQuery({
  args: { userId: v.string(), videoIds: v.array(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const missing: Array<string> = [];
    for (const videoId of args.videoIds) {
      const existing = await ctx.db
        .query("videos")
        .withIndex("by_userId_and_videoId", (q) =>
          q.eq("userId", args.userId).eq("videoId", videoId)
        )
        .unique();
      if (!existing) {
        missing.push(videoId);
      }
    }
    return missing;
  },
});

export const upsertVideo = internalMutation({
  args: {
    userId: v.string(),
    videoId: v.string(),
    date: v.string(),
    title: v.string(),
    transcriptMd: v.string(),
    summaryMd: v.optional(v.string()),
    briefSummaryMd: v.optional(v.string()),
    thumbnailUrl: v.string(),
    metadata: v.optional(videoMetadataValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("videos")
      .withIndex("by_userId_and_videoId", (q) =>
        q.eq("userId", args.userId).eq("videoId", args.videoId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        date: args.date,
        title: args.title,
        transcriptMd: args.transcriptMd,
        summaryMd: args.summaryMd,
        briefSummaryMd: args.briefSummaryMd,
        thumbnailUrl: args.thumbnailUrl,
        metadata: args.metadata,
      });
    } else {
      await ctx.db.insert("videos", {
        userId: args.userId,
        videoId: args.videoId,
        date: args.date,
        title: args.title,
        transcriptMd: args.transcriptMd,
        summaryMd: args.summaryMd,
        briefSummaryMd: args.briefSummaryMd,
        thumbnailUrl: args.thumbnailUrl,
        metadata: args.metadata,
      });
    }
    return null;
  },
});
