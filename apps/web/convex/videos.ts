import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

const videoViewValidator = v.union(v.literal("active"), v.literal("archived"));

export const listPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    view: videoViewValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const indexedVideos =
      args.view === "active"
        ? ctx.db
            .query("videos")
            .withIndex("by_userId_and_archivedAt", (q) =>
              q.eq("userId", userId).eq("archivedAt", undefined)
            )
        : ctx.db
            .query("videos")
            .withIndex("by_userId_and_archivedAt", (q) =>
              q.eq("userId", userId).gt("archivedAt", 0)
            );
    const results = await indexedVideos.order("desc").paginate(args.paginationOpts);
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
        archivedAt: video.archivedAt,
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
      archivedAt: v.optional(v.number()),
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
      archivedAt: video.archivedAt,
    };
  },
});

export const archive = mutation({
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
      await ctx.db.patch(video._id, { archivedAt: Date.now() });
    }
    return null;
  },
});

export const unarchive = mutation({
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
      await ctx.db.patch(video._id, { archivedAt: undefined });
    }
    return null;
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
