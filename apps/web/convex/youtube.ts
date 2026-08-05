// Shared by the Convex enqueue mutation and the queue page input.
export function normalizeInputToken(token: string) {
  return token
    .trim()
    .replace(/^<+/, "")
    .replace(/^\(+/, "")
    .replace(/^\[+/, "")
    .replace(/[>)\].,;]+$/, "");
}

export function extractVideoId(value: string) {
  const token = normalizeInputToken(value);
  const patterns = [
    /(?:v=|\/v\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = token.match(pattern);
    if (match) return match[1];
  }
  return /^[a-zA-Z0-9_-]{11}$/.test(token) ? token : null;
}

export function canonicalUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function thumbnailUrl(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function parseInput(input: string) {
  const parsed: Array<{ videoId: string; url: string }> = [];
  const invalidInputs: Array<string> = [];

  for (const rawToken of input.split(/\s+/)) {
    const token = normalizeInputToken(rawToken);
    if (!token) continue;

    const videoId = extractVideoId(token);
    if (!videoId) {
      invalidInputs.push(token);
      continue;
    }

    parsed.push({ videoId, url: canonicalUrl(videoId) });
  }

  return { parsed, invalidInputs };
}
