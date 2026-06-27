import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { videoMetadataValidator } from "./validators";
import { normalizeTags } from "./tagUtils";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const videoFolderScopeValidator = v.union(
  v.object({ kind: v.literal("all") }),
  v.object({ kind: v.literal("inbox") }),
  v.object({ kind: v.literal("archived") }),
  v.object({ kind: v.literal("folder"), folderId: v.id("folders") })
);
const serializeMetadata = (metadata: {
  version?: number;
  videoId?: string;
  url?: string;
  title?: string;
  author?: string;
  fetchedAt?: string;
  aiEngine?: string;
  model?: string;
  briefSummaryGeneratedAt?: string;
  summaryGeneratedAt?: string;
} | undefined) => metadata ?? null;
const serializeTags = (tags: Array<string> | undefined) => tags ?? [];

function serializeVideoSummary(video: Doc<"videos">) {
  return {
    _id: video._id,
    _creationTime: video._creationTime,
    videoId: video.videoId,
    folderId: video.folderId,
    date: video.date,
    title: video.title,
    hasSummary: video.summaryMd !== undefined,
    tags: serializeTags(video.tags),
    thumbnailUrl: video.thumbnailUrl,
    metadata: serializeMetadata(video.metadata),
    archivedAt: video.archivedAt,
    readAt: video.readAt,
  };
}

async function findVideoByUserAndVideoId(
  ctx: QueryCtx,
  userId: string,
  videoId: string
) {
  return await ctx.db
    .query("videos")
    .withIndex("by_userId_and_videoId", (q) =>
      q.eq("userId", userId).eq("videoId", videoId)
    )
    .unique();
}

async function deleteVideoTagRows(
  ctx: MutationCtx,
  userId: string,
  videoId: string
) {
  const rows = await ctx.db
    .query("videoTags")
    .withIndex("by_userId_and_videoId", (q) =>
      q.eq("userId", userId).eq("videoId", videoId)
    )
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}

async function replaceVideoTagRows(
  ctx: MutationCtx,
  video: Doc<"videos">,
  tags: Array<string>
) {
  await deleteVideoTagRows(ctx, video.userId, video.videoId);
  for (const tag of tags) {
    await ctx.db.insert("videoTags", {
      userId: video.userId,
      videoId: video.videoId,
      tag,
      folderId: video.folderId,
      archivedAt: video.archivedAt,
      date: video.date,
    });
  }
}

async function patchVideoTagRows(
  ctx: MutationCtx,
  userId: string,
  videoId: string,
  patch: {
    folderId?: Id<"folders">;
    archivedAt?: number;
    clearFolderId?: boolean;
    clearArchivedAt?: boolean;
  }
) {
  const rows = await ctx.db
    .query("videoTags")
    .withIndex("by_userId_and_videoId", (q) =>
      q.eq("userId", userId).eq("videoId", videoId)
    )
    .collect();
  for (const row of rows) {
    await ctx.db.patch(row._id, {
      ...(patch.clearFolderId ? { folderId: undefined } : {}),
      ...(patch.folderId !== undefined ? { folderId: patch.folderId } : {}),
      ...(patch.clearArchivedAt ? { archivedAt: undefined } : {}),
      ...(patch.archivedAt !== undefined ? { archivedAt: patch.archivedAt } : {}),
    });
  }
}

export const listPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    folderScope: videoFolderScopeValidator,
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const tag = args.tag ? normalizeTags([args.tag])[0] : undefined;
    if (tag) {
      const indexedTagRows =
        args.folderScope.kind === "archived"
          ? ctx.db
              .query("videoTags")
              .withIndex("by_userId_and_tag_and_archivedAt_and_date", (q) =>
                q.eq("userId", userId).eq("tag", tag).gt("archivedAt", 0)
              )
          : args.folderScope.kind === "all"
            ? ctx.db
                .query("videoTags")
                .withIndex("by_userId_and_tag_and_archivedAt_and_date", (q) =>
                  q
                    .eq("userId", userId)
                    .eq("tag", tag)
                    .eq("archivedAt", undefined)
                )
            : ctx.db
                .query("videoTags")
                .withIndex(
                  "by_userId_and_tag_and_folderId_and_archivedAt_and_date",
                  (q) =>
                    q
                      .eq("userId", userId)
                      .eq("tag", tag)
                      .eq(
                        "folderId",
                        args.folderScope.kind === "folder"
                          ? args.folderScope.folderId
                          : undefined
                      )
                      .eq("archivedAt", undefined)
                );
      const tagResults = await indexedTagRows
        .order("desc")
        .paginate(args.paginationOpts);
      const videos: Array<Doc<"videos">> = [];
      for (const row of tagResults.page) {
        const video = await findVideoByUserAndVideoId(ctx, userId, row.videoId);
        if (video) {
          videos.push(video);
        }
      }
      return {
        ...tagResults,
        page: videos.map(serializeVideoSummary),
      };
    }

    const indexedVideos =
      args.folderScope.kind === "archived"
        ? ctx.db
            .query("videos")
            .withIndex("by_userId_and_archivedAt", (q) =>
              q.eq("userId", userId).gt("archivedAt", 0)
            )
        : args.folderScope.kind === "all"
          ? ctx.db
              .query("videos")
              .withIndex("by_userId_and_archivedAt_and_date", (q) =>
                q.eq("userId", userId).eq("archivedAt", undefined)
              )
          : ctx.db
              .query("videos")
              .withIndex("by_userId_and_folderId_and_archivedAt_and_date", (q) =>
                q
                  .eq("userId", userId)
                  .eq(
                    "folderId",
                    args.folderScope.kind === "folder"
                      ? args.folderScope.folderId
                      : undefined
                  )
                  .eq("archivedAt", undefined)
              );
    const results = await indexedVideos.order("desc").paginate(args.paginationOpts);
    return {
      ...results,
      page: results.page.map(serializeVideoSummary),
    };
  },
});

export const get = query({
  args: { videoId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("videos"),
      videoId: v.string(),
      folderId: v.optional(v.id("folders")),
      date: v.string(),
      title: v.string(),
      summaryMd: v.union(v.string(), v.null()),
      briefSummaryMd: v.union(v.string(), v.null()),
      tags: v.array(v.string()),
      transcriptMd: v.string(),
      thumbnailUrl: v.string(),
      metadata: v.union(videoMetadataValidator, v.null()),
      archivedAt: v.optional(v.number()),
      readAt: v.optional(v.number()),
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
      folderId: video.folderId,
      date: video.date,
      title: video.title,
      summaryMd: video.summaryMd ?? null,
      briefSummaryMd: video.briefSummaryMd ?? null,
      tags: serializeTags(video.tags),
      transcriptMd: video.transcriptMd,
      thumbnailUrl: video.thumbnailUrl,
      metadata: serializeMetadata(video.metadata),
      archivedAt: video.archivedAt,
      readAt: video.readAt,
    };
  },
});

export const moveToFolder = mutation({
  args: {
    videoIds: v.array(v.string()),
    folderId: v.union(v.id("folders"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    if (args.folderId !== null) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== userId) {
        throw new Error("Folder not found");
      }
    }

    for (const videoId of args.videoIds) {
      const video = await ctx.db
        .query("videos")
        .withIndex("by_userId_and_videoId", (q) =>
          q.eq("userId", userId).eq("videoId", videoId)
        )
        .unique();
      if (video) {
        await ctx.db.patch(video._id, {
          folderId: args.folderId ?? undefined,
          archivedAt: undefined,
        });
        await patchVideoTagRows(ctx, userId, video.videoId, {
          ...(args.folderId === null
            ? { clearFolderId: true }
            : { folderId: args.folderId }),
          clearArchivedAt: true,
        });
      }
    }
    return null;
  },
});

export const markRead = mutation({
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
      await ctx.db.patch(video._id, { readAt: Date.now() });
    }
    return null;
  },
});

export const markUnread = mutation({
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
      await ctx.db.patch(video._id, { readAt: undefined });
    }
    return null;
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
      const archivedAt = Date.now();
      await ctx.db.patch(video._id, {
        archivedAt,
        folderId: undefined,
      });
      await patchVideoTagRows(ctx, userId, video.videoId, {
        archivedAt,
        clearFolderId: true,
      });
    }
    return null;
  },
});

export const archiveMany = mutation({
  args: { videoIds: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const archivedAt = Date.now();

    for (const videoId of args.videoIds) {
      const video = await ctx.db
        .query("videos")
        .withIndex("by_userId_and_videoId", (q) =>
          q.eq("userId", userId).eq("videoId", videoId)
        )
        .unique();
      if (video) {
        await ctx.db.patch(video._id, {
          archivedAt,
          folderId: undefined,
        });
        await patchVideoTagRows(ctx, userId, video.videoId, {
          archivedAt,
          clearFolderId: true,
        });
      }
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
      await patchVideoTagRows(ctx, userId, video.videoId, {
        clearArchivedAt: true,
      });
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
      await deleteVideoTagRows(ctx, userId, video.videoId);
      await ctx.db.delete(video._id);
    }
    return null;
  },
});

export const setTags = mutation({
  args: {
    videoId: v.string(),
    tags: v.array(v.string()),
  },
  returns: v.array(v.string()),
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
    if (!video) {
      throw new Error("Video not found");
    }

    const tags = normalizeTags(args.tags);
    await ctx.db.patch(video._id, { tags });
    await replaceVideoTagRows(ctx, { ...video, tags }, tags);
    return tags;
  },
});
