import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import * as folders from "../convex/folders"
import * as videos from "../convex/videos"

const TABLES = ["folders", "videos", "videoTags", "apiKeys"]

class FakeDb {
  constructor() {
    this.clock = 1
    this.tables = Object.fromEntries(TABLES.map((table) => [table, new Map()]))
  }

  async insert(table, doc) {
    const id = `${table}:${this.clock++}`
    this.tables[table].set(id, {
      _id: id,
      _creationTime: this.clock,
      ...doc,
    })
    return id
  }

  async get(id) {
    return this.tableForId(id).get(id) ?? null
  }

  async patch(id, patch) {
    const table = this.tableForId(id)
    const current = table.get(id)
    if (!current) throw new Error(`Missing document ${id}`)
    table.set(id, { ...current, ...patch })
  }

  async delete(id) {
    this.tableForId(id).delete(id)
  }

  query(table) {
    return new FakeQuery([...this.tables[table].values()])
  }

  tableForId(id) {
    const tableName = String(id).split(":")[0]
    const table = this.tables[tableName]
    if (!table) throw new Error(`Unknown table for id ${id}`)
    return table
  }
}

class FakeQuery {
  constructor(rows) {
    this.rows = rows
    this.filters = []
    this.direction = "asc"
  }

  withIndex(_name, build) {
    const filters = []
    const q = {
      eq: (field, value) => {
        filters.push({ op: "eq", field, value })
        return q
      },
      gt: (field, value) => {
        filters.push({ op: "gt", field, value })
        return q
      },
    }
    build(q)
    this.filters.push(...filters)
    return this
  }

  order(direction) {
    this.direction = direction
    return this
  }

  async collect() {
    return this.filtered()
  }

  async unique() {
    const rows = this.filtered()
    if (rows.length > 1) throw new Error("Expected unique result")
    return rows[0] ?? null
  }

  async paginate() {
    return {
      page: this.filtered(),
      isDone: true,
      continueCursor: "",
    }
  }

  filtered() {
    const rows = this.rows.filter((row) =>
      this.filters.every((filter) => {
        const value = row[filter.field]
        if (filter.op === "eq") return value === filter.value
        if (filter.op === "gt") return value !== undefined && value > filter.value
        return false
      })
    )

    if (this.direction === "desc") {
      return rows.toSorted((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    }
    return rows
  }
}

function createCtx(userId = "user-a") {
  return {
    auth: {
      async getUserIdentity() {
        return { subject: userId }
      },
    },
    db: new FakeDb(),
  }
}

async function insertVideo(ctx, overrides = {}) {
  return await ctx.db.insert("videos", {
    userId: "user-a",
    videoId: `video-${ctx.db.clock}`,
    date: "2026-01-01",
    title: "Video",
    transcriptMd: "# Transcript",
    thumbnailUrl: "https://example.com/thumb.jpg",
    ...overrides,
  })
}

async function call(fn, ctx, args = {}) {
  return await fn._handler(ctx, args)
}

let now

beforeEach(() => {
  now = Date.now
  Date.now = () => 1234567890
})

test("folders can be created, listed, and renamed for the current user", async (t) => {
  t.after(() => {
    Date.now = now
  })
  const ctx = createCtx()

  const folderId = await call(folders.create, ctx, { name: "  Watch later  " })
  await call(folders.rename, ctx, { folderId, name: "Research" })

  const listed = await call(folders.list, ctx)

  assert.equal(listed.length, 1)
  assert.equal(listed[0].name, "Research")
  assert.equal(listed[0].videoCount, 0)
})

test("folder mutations reject folders owned by another user", async (t) => {
  t.after(() => {
    Date.now = now
  })
  const ownerCtx = createCtx("owner")
  const otherCtx = { ...createCtx("other"), db: ownerCtx.db }
  const folderId = await call(folders.create, ownerCtx, { name: "Private" })

  await assert.rejects(
    call(folders.rename, otherCtx, { folderId, name: "Stolen" }),
    /Folder not found/
  )
  await assert.rejects(
    call(videos.moveToFolder, otherCtx, { videoIds: ["video-1"], folderId }),
    /Folder not found/
  )
})

test("videos can be moved into a folder as a single item or group", async (t) => {
  t.after(() => {
    Date.now = now
  })
  const ctx = createCtx()
  const folderId = await call(folders.create, ctx, { name: "Course" })
  const firstId = await insertVideo(ctx, { videoId: "first" })
  const secondId = await insertVideo(ctx, { videoId: "second" })

  await call(videos.moveToFolder, ctx, {
    videoIds: ["first", "second"],
    folderId,
  })

  assert.equal((await ctx.db.get(firstId)).folderId, folderId)
  assert.equal((await ctx.db.get(secondId)).folderId, folderId)

  const listed = await call(videos.listPage, ctx, {
    folderScope: { kind: "folder", folderId },
    paginationOpts: { numItems: 50, cursor: null },
  })
  assert.deepEqual(listed.page.map((video) => video.videoId), ["first", "second"])
})

test("videos can be moved back to Inbox", async (t) => {
  t.after(() => {
    Date.now = now
  })
  const ctx = createCtx()
  const folderId = await call(folders.create, ctx, { name: "Course" })
  const videoId = await insertVideo(ctx, { videoId: "first", folderId })

  await call(videos.moveToFolder, ctx, {
    videoIds: ["first"],
    folderId: null,
  })

  assert.equal((await ctx.db.get(videoId)).folderId, undefined)
})

test("videos can be renamed by their owner", async (t) => {
  t.after(() => {
    Date.now = now
  })
  const ctx = createCtx()
  const videoDocumentId = await insertVideo(ctx, {
    videoId: "rename-me",
    title: "Original title",
  })

  await call(videos.rename, ctx, {
    videoId: "rename-me",
    title: "  Updated title  ",
  })

  assert.equal((await ctx.db.get(videoDocumentId)).title, "Updated title")
})

test("renaming a video rejects empty titles and videos owned by another user", async (t) => {
  t.after(() => {
    Date.now = now
  })
  const ownerCtx = createCtx("user-a")
  const otherCtx = { ...createCtx("user-b"), db: ownerCtx.db }
  await insertVideo(ownerCtx, { videoId: "private-video" })

  await assert.rejects(
    call(videos.rename, ownerCtx, { videoId: "private-video", title: "   " }),
    /Video title is required/
  )
  await assert.rejects(
    call(videos.rename, otherCtx, {
      videoId: "private-video",
      title: "Stolen title",
    }),
    /Video not found/
  )
})

test("deleting a non-empty folder archives active videos and clears folder membership", async (t) => {
  t.after(() => {
    Date.now = now
  })
  const ctx = createCtx()
  const folderId = await call(folders.create, ctx, { name: "Course" })
  const activeId = await insertVideo(ctx, { videoId: "active", folderId })
  const archivedId = await insertVideo(ctx, {
    videoId: "archived",
    folderId,
    archivedAt: 42,
  })

  await call(folders.remove, ctx, {
    folderId,
    archiveContainedVideos: true,
  })

  assert.equal(await ctx.db.get(folderId), null)
  assert.equal((await ctx.db.get(activeId)).folderId, undefined)
  assert.equal((await ctx.db.get(activeId)).archivedAt, 1234567890)
  assert.equal((await ctx.db.get(archivedId)).folderId, undefined)
  assert.equal((await ctx.db.get(archivedId)).archivedAt, 42)
})

test("deleting a non-empty folder requires the archive-contained-videos flag", async (t) => {
  t.after(() => {
    Date.now = now
  })
  const ctx = createCtx()
  const folderId = await call(folders.create, ctx, { name: "Course" })
  await insertVideo(ctx, { videoId: "active", folderId })

  await assert.rejects(
    call(folders.remove, ctx, {
      folderId,
      archiveContainedVideos: false,
    }),
    /Folder contains videos/
  )
  assert.notEqual(await ctx.db.get(folderId), null)
})
