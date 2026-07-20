import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { normalizeTags } from "./tagUtils";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeVideoMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const source = value as Record<string, unknown>;
  const metadata: Record<string, string | number> = {};
  for (const key of [
    "videoId",
    "url",
    "title",
    "author",
    "fetchedAt",
    "aiEngine",
    "model",
    "briefSummaryGeneratedAt",
    "summaryGeneratedAt",
  ]) {
    const field = source[key];
    if (typeof field === "string") {
      metadata[key] = field;
    }
  }
  if (typeof source.version === "number") {
    metadata.version = source.version;
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function parseUploadTags(value: unknown) {
  if (value === undefined) {
    return { ok: true as const, tags: undefined };
  }
  if (!Array.isArray(value) || !value.every((tag) => typeof tag === "string")) {
    return { ok: false as const };
  }
  return { ok: true as const, tags: normalizeTags(value) };
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

async function authenticateApiKey(
  req: Request,
  resolveApiKey: (keyHash: string) => Promise<string | null>
) {
  const keyHash = await getKeyHash(req);
  if (!keyHash) {
    return { response: jsonResponse({ error: "Missing API key" }, 401) };
  }

  const userId = await resolveApiKey(keyHash);
  if (!userId) {
    return { response: jsonResponse({ error: "Invalid API key" }, 401) };
  }

  return { userId };
}

http.route({
  path: "/api/upload",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticateApiKey(req, (keyHash) =>
      ctx.runQuery(internal.auth.resolveApiKey, { keyHash })
    );
    if (auth.response) return auth.response;
    const userId = auth.userId;

    const body = await req.json();
    const parsedTags = parseUploadTags(body.tags);
    if (!parsedTags.ok) {
      return jsonResponse({ error: "Expected tags array" }, 400);
    }

    await ctx.runMutation(internal.auth.upsertVideo, {
      userId,
      videoId: body.videoId,
      date: body.date,
      title: body.title,
      transcriptMd: body.transcriptMd,
      summaryMd: body.summaryMd ?? undefined,
      briefSummaryMd: body.briefSummaryMd ?? undefined,
      tags: parsedTags.tags,
      thumbnailUrl: body.thumbnailUrl,
      metadata: normalizeVideoMetadata(body.metadata),
    });

    return jsonResponse({ ok: true }, 200);
  }),
});

http.route({
  path: "/api/missing",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticateApiKey(req, (keyHash) =>
      ctx.runQuery(internal.auth.resolveApiKey, { keyHash })
    );
    if (auth.response) return auth.response;
    const userId = auth.userId;

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

http.route({
  path: "/api/queue/claim",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticateApiKey(req, (keyHash) =>
      ctx.runQuery(internal.auth.resolveApiKey, { keyHash })
    );
    if (auth.response) return auth.response;
    const userId = auth.userId;

    const body: unknown = await req.json().catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      !("workerId" in body) ||
      typeof body.workerId !== "string" ||
      !body.workerId
    ) {
      return jsonResponse({ error: "Expected workerId" }, 400);
    }

    const item = await ctx.runMutation(internal.transcriptionQueue.claimNext, {
      userId,
      workerId: body.workerId,
    });

    return jsonResponse({ item }, 200);
  }),
});

http.route({
  path: "/api/queue/complete",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticateApiKey(req, (keyHash) =>
      ctx.runQuery(internal.auth.resolveApiKey, { keyHash })
    );
    if (auth.response) return auth.response;
    const userId = auth.userId;

    const body: unknown = await req.json().catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      !("id" in body) ||
      typeof body.id !== "string" ||
      !("workerId" in body) ||
      typeof body.workerId !== "string" ||
      !body.workerId
    ) {
      return jsonResponse({ error: "Expected id and workerId" }, 400);
    }

    const ok: boolean = await ctx.runMutation(
      internal.transcriptionQueue.completeClaimed,
      {
        userId,
        id: body.id as Id<"transcriptionQueue">,
        workerId: body.workerId,
      }
    );
    if (!ok) {
      return jsonResponse({ error: "Queue claim not found" }, 409);
    }

    return jsonResponse({ ok: true }, 200);
  }),
});

http.route({
  path: "/api/queue/fail",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticateApiKey(req, (keyHash) =>
      ctx.runQuery(internal.auth.resolveApiKey, { keyHash })
    );
    if (auth.response) return auth.response;
    const userId = auth.userId;

    const body: unknown = await req.json().catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      !("id" in body) ||
      typeof body.id !== "string" ||
      !("workerId" in body) ||
      typeof body.workerId !== "string" ||
      !body.workerId ||
      !("errorMessage" in body) ||
      typeof body.errorMessage !== "string"
    ) {
      return jsonResponse({ error: "Expected id, workerId, and errorMessage" }, 400);
    }

    const ok: boolean = await ctx.runMutation(
      internal.transcriptionQueue.failClaimed,
      {
        userId,
        id: body.id as Id<"transcriptionQueue">,
        workerId: body.workerId,
        errorMessage: body.errorMessage,
      }
    );
    if (!ok) {
      return jsonResponse({ error: "Queue claim not found" }, 409);
    }

    return jsonResponse({ ok: true }, 200);
  }),
});

export default http;
