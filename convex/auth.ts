import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

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

export const upsertVideo = internalMutation({
  args: {
    userId: v.string(),
    videoId: v.string(),
    date: v.string(),
    title: v.string(),
    transcriptMd: v.string(),
    summaryMd: v.optional(v.string()),
    thumbnailUrl: v.string(),
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
        thumbnailUrl: args.thumbnailUrl,
      });
    } else {
      await ctx.db.insert("videos", {
        userId: args.userId,
        videoId: args.videoId,
        date: args.date,
        title: args.title,
        transcriptMd: args.transcriptMd,
        summaryMd: args.summaryMd,
        thumbnailUrl: args.thumbnailUrl,
      });
    }
    return null;
  },
});
