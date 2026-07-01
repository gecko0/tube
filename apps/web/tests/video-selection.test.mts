import assert from "node:assert/strict"
import { test } from "node:test"
import { buildRangeIds } from "@/features/videos/lib/video-selection"

function video(videoId) {
  return {
    _id: `videos:${videoId}`,
    _creationTime: 1,
    videoId,
    date: "2026-01-01",
    title: videoId,
    hasSummary: false,
    tags: [],
    thumbnailUrl: "https://example.com/thumb.jpg",
    metadata: null,
  }
}

test("buildRangeIds selects the visible contiguous range from anchor to target", () => {
  const videos = ["a", "b", "c", "d", "e"].map(video)

  assert.deepEqual(buildRangeIds("b", "d", videos), ["b", "c", "d"])
})

test("buildRangeIds supports reverse range selection", () => {
  const videos = ["a", "b", "c", "d", "e"].map(video)

  assert.deepEqual(buildRangeIds("d", "b", videos), ["b", "c", "d"])
})

test("buildRangeIds falls back to the target when either endpoint is not visible", () => {
  const videos = ["a", "b", "c"].map(video)

  assert.deepEqual(buildRangeIds("missing", "b", videos), ["b"])
  assert.deepEqual(buildRangeIds("a", "missing", videos), ["missing"])
})
