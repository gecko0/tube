export const MAX_VIDEO_TAGS = 8;

export function normalizeTags(rawTags: Array<string>): Array<string> {
  const tags: Array<string> = [];
  const seen = new Set<string>();

  for (const rawTag of rawTags) {
    const tag = rawTag
      .trim()
      .toLowerCase()
      .replace(/^#+/, "")
      .replace(/\s+/g, " ");
    if (!tag || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= MAX_VIDEO_TAGS) {
      break;
    }
  }

  return tags;
}
