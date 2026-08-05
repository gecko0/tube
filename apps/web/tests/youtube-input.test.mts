import assert from "node:assert/strict"
import { test } from "node:test"
import { parseInput, thumbnailUrl } from "../convex/youtube"

const DIRTY =
  "https://www.youtube.com/watch?v=M6mYodf0dJM&list=WL&index=3&t=1s"
const CLEAN = "https://www.youtube.com/watch?v=M6mYodf0dJM"

test("parseInput strips playlist and timestamp params", () => {
  assert.deepEqual(parseInput(DIRTY), {
    parsed: [{ videoId: "M6mYodf0dJM", url: CLEAN }],
    invalidInputs: [],
  })
})

test("parseInput handles short, shorts and bare-id forms", () => {
  const { parsed, invalidInputs } = parseInput(
    "https://youtu.be/M6mYodf0dJM?si=abc https://www.youtube.com/shorts/M6mYodf0dJN M6mYodf0dJO"
  )

  assert.deepEqual(
    parsed.map((item) => item.videoId),
    ["M6mYodf0dJM", "M6mYodf0dJN", "M6mYodf0dJO"]
  )
  assert.deepEqual(invalidInputs, [])
})

test("parseInput reports unrecognized tokens as invalid", () => {
  assert.deepEqual(parseInput(`${DIRTY} nonsense`).invalidInputs, ["nonsense"])
})

test("thumbnailUrl builds the preview image url for a video id", () => {
  assert.equal(
    thumbnailUrl(parseInput(DIRTY).parsed[0].videoId),
    "https://img.youtube.com/vi/M6mYodf0dJM/hqdefault.jpg"
  )
})
