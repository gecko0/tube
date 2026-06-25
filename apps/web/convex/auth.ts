import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { videoMetadataValidator } from "./validators";
import { normalizeTags } from "./tagUtils";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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

async function replaceVideoTagRows(
  ctx: MutationCtx,
  args: {
    userId: string;
    videoId: string;
    tags: Array<string>;
    folderId?: Id<"folders">;
    archivedAt?: number;
    date: string;
  }
) {
  const existingRows = await ctx.db
    .query("videoTags")
    .withIndex("by_userId_and_videoId", (q) =>
      q.eq("userId", args.userId).eq("videoId", args.videoId)
    )
    .collect();
  for (const row of existingRows) {
    await ctx.db.delete(row._id);
  }

  for (const tag of args.tags) {
    await ctx.db.insert("videoTags", {
      userId: args.userId,
      videoId: args.videoId,
      tag,
      folderId: args.folderId,
      archivedAt: args.archivedAt,
      date: args.date,
    });
  }
}

export const upsertVideo = internalMutation({
  args: {
    userId: v.string(),
    videoId: v.string(),
    date: v.string(),
    title: v.string(),
    transcriptMd: v.string(),
    summaryMd: v.optional(v.string()),
    briefSummaryMd: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
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
    const tags = args.tags === undefined ? undefined : normalizeTags(args.tags);

    if (existing) {
      await ctx.db.patch(existing._id, {
        date: args.date,
        title: args.title,
        transcriptMd: args.transcriptMd,
        summaryMd: args.summaryMd,
        briefSummaryMd: args.briefSummaryMd,
        ...(tags !== undefined ? { tags } : {}),
        thumbnailUrl: args.thumbnailUrl,
        metadata: args.metadata,
      });
      if (tags !== undefined) {
        await replaceVideoTagRows(ctx, {
          userId: args.userId,
          videoId: args.videoId,
          tags,
          folderId: existing.folderId,
          archivedAt: existing.archivedAt,
          date: args.date,
        });
      }
    } else {
      await ctx.db.insert("videos", {
        userId: args.userId,
        videoId: args.videoId,
        date: args.date,
        title: args.title,
        transcriptMd: args.transcriptMd,
        summaryMd: args.summaryMd,
        briefSummaryMd: args.briefSummaryMd,
        tags,
        thumbnailUrl: args.thumbnailUrl,
        metadata: args.metadata,
      });
      if (tags !== undefined) {
        await replaceVideoTagRows(ctx, {
          userId: args.userId,
          videoId: args.videoId,
          tags,
          date: args.date,
        });
      }
    }
    return null;
  },
});
