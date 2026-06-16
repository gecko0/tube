import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

export const listPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const results = await ctx.db
      .query("videos")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...results,
      page: results.page.map((video) => ({
        _id: video._id,
        _creationTime: video._creationTime,
        videoId: video.videoId,
        date: video.date,
        title: video.title,
        hasSummary: video.summaryMd !== undefined,
        thumbnailUrl: video.thumbnailUrl,
      })),
    };
  },
});

export const get = query({
  args: { videoId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("videos"),
      videoId: v.string(),
      date: v.string(),
      title: v.string(),
      summaryMd: v.union(v.string(), v.null()),
      transcriptMd: v.string(),
      thumbnailUrl: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const video = await ctx.db
      .query("videos")
      .withIndex("by_userId_and_videoId", (q) =>
        q.eq("userId", userId).eq("videoId", args.videoId)
      )
      .unique();
    if (!video) return null;
    return {
      _id: video._id,
      videoId: video.videoId,
      date: video.date,
      title: video.title,
      summaryMd: video.summaryMd ?? null,
      transcriptMd: video.transcriptMd,
      thumbnailUrl: video.thumbnailUrl,
    };
  },
});

export const remove = mutation({
  args: { videoId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const video = await ctx.db
      .query("videos")
      .withIndex("by_userId_and_videoId", (q) =>
        q.eq("userId", userId).eq("videoId", args.videoId)
      )
      .unique();
    if (video) {
      await ctx.db.delete(video._id);
    }
    return null;
  },
});
