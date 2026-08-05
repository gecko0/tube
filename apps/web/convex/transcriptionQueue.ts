import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { parseInput } from "./youtube";

const ACTIVE_STATUSES = ["queued", "processing", "error"] as const;
const CLAIM_DURATION_MS = 10 * 60 * 1000;

const queueStatusValidator = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("error")
);

const queueItemValidator = v.object({
  _id: v.id("transcriptionQueue"),
  _creationTime: v.number(),
  videoId: v.string(),
  url: v.string(),
  status: queueStatusValidator,
  errorMessage: v.optional(v.string()),
  attempts: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  claimedBy: v.optional(v.string()),
  claimExpiresAt: v.optional(v.number()),
});

function serializeQueueItem(item: Doc<"transcriptionQueue">) {
  return {
    _id: item._id,
    _creationTime: item._creationTime,
    videoId: item.videoId,
    url: item.url,
    status: item.status,
    errorMessage: item.errorMessage,
    attempts: item.attempts,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    claimedBy: item.claimedBy,
    claimExpiresAt: item.claimExpiresAt,
  };
}

async function findVideo(
  ctx: QueryCtx | MutationCtx,
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

async function findQueueItemForStatus(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  videoId: string,
  status: (typeof ACTIVE_STATUSES)[number]
) {
  return await ctx.db
    .query("transcriptionQueue")
    .withIndex("by_userId_and_videoId_and_status", (q) =>
      q.eq("userId", userId).eq("videoId", videoId).eq("status", status)
    )
    .unique();
}

async function findActiveQueueItem(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  videoId: string
) {
  for (const status of ACTIVE_STATUSES) {
    const item = await findQueueItemForStatus(ctx, userId, videoId, status);
    if (item) return item;
  }
  return null;
}

export const enqueue = mutation({
  args: { input: v.string() },
  returns: v.object({
    queued: v.number(),
    skipped: v.number(),
    invalid: v.number(),
    queuedVideoIds: v.array(v.string()),
    skippedVideoIds: v.array(v.string()),
    invalidInputs: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const now = Date.now();
    const { parsed, invalidInputs } = parseInput(args.input);
    const seen = new Set<string>();
    const queuedVideoIds: Array<string> = [];
    const skippedVideoIds: Array<string> = [];

    for (const item of parsed) {
      if (seen.has(item.videoId)) {
        skippedVideoIds.push(item.videoId);
        continue;
      }
      seen.add(item.videoId);

      const existingVideo = await findVideo(ctx, userId, item.videoId);
      const existingQueueItem = await findActiveQueueItem(
        ctx,
        userId,
        item.videoId
      );
      if (existingVideo || existingQueueItem) {
        skippedVideoIds.push(item.videoId);
        continue;
      }

      await ctx.db.insert("transcriptionQueue", {
        userId,
        videoId: item.videoId,
        url: item.url,
        status: "queued" as const,
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      });
      queuedVideoIds.push(item.videoId);
    }

    return {
      queued: queuedVideoIds.length,
      skipped: skippedVideoIds.length,
      invalid: invalidInputs.length,
      queuedVideoIds,
      skippedVideoIds,
      invalidInputs,
    };
  },
});

export const list = query({
  args: {},
  returns: v.array(queueItemValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const rows: Array<Doc<"transcriptionQueue">> = [];

    for (const status of ACTIVE_STATUSES) {
      const statusRows = await ctx.db
        .query("transcriptionQueue")
        .withIndex("by_userId_and_status_and_createdAt", (q) =>
          q.eq("userId", userId).eq("status", status)
        )
        .collect();
      rows.push(...statusRows);
    }

    rows.sort((a, b) => a.createdAt - b.createdAt);
    return rows.map(serializeQueueItem);
  },
});

export const count = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    let total = 0;

    for (const status of ACTIVE_STATUSES) {
      const rows = await ctx.db
        .query("transcriptionQueue")
        .withIndex("by_userId_and_status_and_createdAt", (q) =>
          q.eq("userId", userId).eq("status", status)
        )
        .collect();
      total += rows.length;
    }

    return total;
  },
});

export const retry = mutation({
  args: { id: v.id("transcriptionQueue") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Queue item not found");
    }
    if (item.status !== "error") {
      throw new Error("Only failed queue items can be retried");
    }

    await ctx.db.patch(args.id, {
      status: "queued" as const,
      errorMessage: undefined,
      claimedBy: undefined,
      claimExpiresAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const cancel = mutation({
  args: { id: v.id("transcriptionQueue") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Queue item not found");
    }
    if (item.status === "processing") {
      throw new Error("Processing queue items cannot be canceled");
    }

    await ctx.db.delete(args.id);
    return null;
  },
});

export const claimNext = internalMutation({
  args: { userId: v.string(), workerId: v.string() },
  returns: v.union(queueItemValidator, v.null()),
  handler: async (ctx, args) => {
    const now = Date.now();
    const queued = await ctx.db
      .query("transcriptionQueue")
      .withIndex("by_userId_and_status_and_createdAt", (q) =>
        q.eq("userId", args.userId).eq("status", "queued")
      )
      .order("asc")
      .first();

    const expired = await ctx.db
      .query("transcriptionQueue")
      .withIndex("by_userId_and_status_and_claimExpiresAt", (q) =>
        q
          .eq("userId", args.userId)
          .eq("status", "processing")
          .lt("claimExpiresAt", now)
      )
      .order("asc")
      .first();

    const item =
      queued && expired
        ? queued.createdAt <= expired.createdAt
          ? queued
          : expired
        : queued ?? expired;
    if (!item) return null;

    const claimExpiresAt = now + CLAIM_DURATION_MS;
    await ctx.db.patch(item._id, {
      status: "processing" as const,
      errorMessage: undefined,
      attempts: item.attempts + 1,
      updatedAt: now,
      claimedBy: args.workerId,
      claimExpiresAt,
    });

    return serializeQueueItem({
      ...item,
      status: "processing" as const,
      errorMessage: undefined,
      attempts: item.attempts + 1,
      updatedAt: now,
      claimedBy: args.workerId,
      claimExpiresAt,
    });
  },
});

async function findClaimedItem(
  ctx: MutationCtx,
  id: Id<"transcriptionQueue">,
  userId: string,
  workerId: string
) {
  const item = await ctx.db.get(id);
  if (
    !item ||
    item.userId !== userId ||
    item.status !== "processing" ||
    item.claimedBy !== workerId
  ) {
    return null;
  }
  return item;
}

export const completeClaimed = internalMutation({
  args: {
    userId: v.string(),
    id: v.id("transcriptionQueue"),
    workerId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const item = await findClaimedItem(ctx, args.id, args.userId, args.workerId);
    if (!item) return false;

    await ctx.db.delete(args.id);
    return true;
  },
});

export const failClaimed = internalMutation({
  args: {
    userId: v.string(),
    id: v.id("transcriptionQueue"),
    workerId: v.string(),
    errorMessage: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const item = await findClaimedItem(ctx, args.id, args.userId, args.workerId);
    if (!item) return false;

    await ctx.db.patch(args.id, {
      status: "error" as const,
      errorMessage: args.errorMessage.slice(0, 2000),
      claimedBy: undefined,
      claimExpiresAt: undefined,
      updatedAt: Date.now(),
    });
    return true;
  },
});
