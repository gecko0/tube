import { useCallback, useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { AlertCircle, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react"

import { api } from "../../../convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { QueueStatus, TranscriptionQueueItem } from "@/lib/types"

function statusLabel(status: QueueStatus) {
  if (status === "queued") return "Queued"
  if (status === "processing") return "Processing"
  return "Error"
}

function statusClassName(status: QueueStatus) {
  if (status === "processing") {
    return "border-blue-500/40 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200"
  }
  if (status === "error") {
    return "border-destructive/40 bg-destructive/10 text-destructive"
  }
  return ""
}

function QueueStatusBadge({ status }: { status: QueueStatus }) {
  return (
    <Badge variant="secondary" className={cn("shrink-0", statusClassName(status))}>
      {statusLabel(status)}
    </Badge>
  )
}

function QueueItemRow({
  item,
  onRetry,
  onCancel,
}: {
  item: TranscriptionQueueItem
  onRetry: (item: TranscriptionQueueItem) => void
  onCancel: (item: TranscriptionQueueItem) => void
}) {
  return (
    <div className="grid gap-3 rounded-md border px-3 py-3 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="min-w-0 space-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate font-mono text-sm font-medium">
            {item.videoId}
          </span>
          <QueueStatusBadge status={item.status} />
          {item.attempts > 0 && (
            <span className="text-xs text-muted-foreground">
              Attempt {item.attempts}
            </span>
          )}
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm text-muted-foreground hover:text-foreground"
        >
          {item.url}
        </a>
        {item.status === "error" && item.errorMessage && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words">{item.errorMessage}</span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        {item.status === "error" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRetry(item)}
          >
            <RotateCcw className="size-4" />
            Retry
          </Button>
        )}
        {item.status !== "processing" && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onCancel(item)}
            title="Cancel queued video"
          >
            <Trash2 className="size-4 text-destructive" />
            <span className="sr-only">Cancel queued video</span>
          </Button>
        )}
      </div>
    </div>
  )
}

export function QueuePage() {
  const items = useQuery(api.transcriptionQueue.list)
  const enqueue = useMutation(api.transcriptionQueue.enqueue)
  const retry = useMutation(api.transcriptionQueue.retry)
  const cancel = useMutation(api.transcriptionQueue.cancel)
  const [input, setInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const queueItems = useMemo(() => items ?? [], [items])

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    setSubmitting(true)
    setFeedback(null)
    try {
      const result = await enqueue({ input: trimmed })
      setFeedback(
        `${result.queued} queued, ${result.skipped} skipped, ${result.invalid} invalid`
      )
      if (result.queued > 0) {
        setInput("")
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed to enqueue videos")
    } finally {
      setSubmitting(false)
    }
  }, [enqueue, input])

  const handleRetry = useCallback((item: TranscriptionQueueItem) => {
    void retry({ id: item._id })
  }, [retry])

  const handleCancel = useCallback((item: TranscriptionQueueItem) => {
    void cancel({ id: item._id })
  }, [cancel])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex min-h-8 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-xl font-semibold">Queue</h1>
          <Badge variant="secondary" className="shrink-0">
            {queueItems.length}
          </Badge>
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste YouTube URLs or IDs"
          className="min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-sm text-muted-foreground">
            {feedback}
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={submitting || input.trim().length === 0}
            onClick={handleSubmit}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add to queue
          </Button>
        </div>
      </div>

      {items === undefined ? (
        <div className="flex h-64 items-center justify-center rounded-md border border-dashed">
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      ) : queueItems.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-md border border-dashed">
          <span className="text-sm text-muted-foreground">No queued videos</span>
        </div>
      ) : (
        <div className="space-y-2">
          {queueItems.map((item) => (
            <QueueItemRow
              key={item._id}
              item={item}
              onRetry={handleRetry}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}
    </div>
  )
}
