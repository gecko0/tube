import { readdir } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { createLogger, createServer } from "vite"

const root = path.resolve(import.meta.dirname, "..")
const testsDir = path.join(root, "tests")

async function findTests(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return findTests(fullPath)
      return entry.isFile() && entry.name.endsWith(".test.mts") ? [fullPath] : []
    })
  )
  return files.flat()
}

const logger = createLogger()
const logError = logger.error
logger.error = (message, options) => {
  if (String(message).startsWith("WebSocket server error:")) return
  logError(message, options)
}

const server = await createServer({
  configFile: path.join(root, "vite.config.ts"),
  customLogger: logger,
  server: { hmr: false, middlewareMode: true },
})

try {
  const testFiles = await findTests(testsDir)
  for (const file of testFiles) {
    await server.ssrLoadModule(pathToFileURL(file).href)
  }
} finally {
  await server.close()
}
