import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const folderSummaryValidator = v.object({
  _id: v.id("folders"),
  _creationTime: v.number(),
  name: v.string(),
  parentFolderId: v.optional(v.id("folders")),
  videoCount: v.number(),
});

async function requireUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
}

function normalizeFolderName(name: string) {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Folder name is required");
  }
  return normalized;
}

export const list = query({
  args: {},
  returns: v.array(folderSummaryValidator),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_userId_and_parentFolderId", (q) =>
        q.eq("userId", userId).eq("parentFolderId", undefined)
      )
      .collect();

    const summaries = await Promise.all(
      folders.map(async (folder) => {
        const videos = await ctx.db
          .query("videos")
          .withIndex("by_userId_and_folderId_and_archivedAt", (q) =>
            q
              .eq("userId", userId)
              .eq("folderId", folder._id)
              .eq("archivedAt", undefined)
          )
          .collect();
        return {
          _id: folder._id,
          _creationTime: folder._creationTime,
          name: folder.name,
          parentFolderId: folder.parentFolderId,
          videoCount: videos.length,
        };
      })
    );

    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("folders"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return await ctx.db.insert("folders", {
      userId,
      name: normalizeFolderName(args.name),
    });
  },
});

export const rename = mutation({
  args: { folderId: v.id("folders"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    await ctx.db.patch(args.folderId, {
      name: normalizeFolderName(args.name),
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    folderId: v.id("folders"),
    archiveContainedVideos: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    const videos = await ctx.db
      .query("videos")
      .withIndex("by_userId_and_folderId", (q) =>
        q.eq("userId", userId).eq("folderId", args.folderId)
      )
      .collect();

    if (videos.length > 0 && !args.archiveContainedVideos) {
      throw new Error("Folder contains videos");
    }

    const archivedAt = Date.now();
    for (const video of videos) {
      await ctx.db.patch(video._id, {
        folderId: undefined,
        archivedAt: video.archivedAt ?? archivedAt,
      });
    }

    await ctx.db.delete(args.folderId);
    return null;
  },
});
