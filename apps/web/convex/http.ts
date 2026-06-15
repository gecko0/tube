import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/api/upload",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const rawKey = authHeader.slice(7);

    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const userId: string | null = await ctx.runQuery(
      internal.auth.resolveApiKey,
      { keyHash }
    );
    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    await ctx.runMutation(internal.auth.upsertVideo, {
      userId,
      videoId: body.videoId,
      date: body.date,
      title: body.title,
      transcriptMd: body.transcriptMd,
      summaryMd: body.summaryMd ?? undefined,
      thumbnailUrl: body.thumbnailUrl,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
