import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getKeyHash(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const rawKey = authHeader.slice(7);

  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

http.route({
  path: "/api/upload",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const keyHash = await getKeyHash(req);
    if (!keyHash) {
      return jsonResponse({ error: "Missing API key" }, 401);
    }

    const userId: string | null = await ctx.runQuery(
      internal.auth.resolveApiKey,
      { keyHash }
    );
    if (!userId) {
      return jsonResponse({ error: "Invalid API key" }, 401);
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

    return jsonResponse({ ok: true }, 200);
  }),
});

http.route({
  path: "/api/missing",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const keyHash = await getKeyHash(req);
    if (!keyHash) {
      return jsonResponse({ error: "Missing API key" }, 401);
    }

    const userId: string | null = await ctx.runQuery(
      internal.auth.resolveApiKey,
      { keyHash }
    );
    if (!userId) {
      return jsonResponse({ error: "Invalid API key" }, 401);
    }

    const body: unknown = await req.json().catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      !("videoIds" in body) ||
      !Array.isArray(body.videoIds) ||
      !body.videoIds.every((videoId) => typeof videoId === "string")
    ) {
      return jsonResponse({ error: "Expected videoIds array" }, 400);
    }

    const missingVideoIds: Array<string> = await ctx.runQuery(
      internal.auth.findMissingVideoIds,
      { userId, videoIds: body.videoIds }
    );

    return jsonResponse({ missingVideoIds }, 200);
  }),
});

export default http;
