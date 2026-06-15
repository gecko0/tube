import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("apiKeys"),
      _creationTime: v.number(),
      name: v.string(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return keys.map((k) => ({
      _id: k._id,
      _creationTime: k._creationTime,
      name: k.name,
    }));
  },
});

export const create = mutation({
  args: {
    keyHash: v.string(),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    await ctx.db.insert("apiKeys", {
      userId,
      keyHash: args.keyHash,
      name: args.name,
    });
    return null;
  },
});

export const revoke = mutation({
  args: { id: v.id("apiKeys") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    const key = await ctx.db.get(args.id);
    if (!key || key.userId !== userId) {
      throw new Error("API key not found");
    }
    await ctx.db.delete(args.id);
    return null;
  },
});
