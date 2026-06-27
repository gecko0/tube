import { formatDate } from "@/lib/utils"
import { Streamdown } from "streamdown"
import { code } from "@streamdown/code"
import "streamdown/styles.css"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { VideoTagEditor } from "@/features/videos/components/video-tag-editor"
import { VideoActionsMenu } from "@/features/videos/video-actions-menu"
import type { VideoDetail as VideoDetailType } from "@/lib/types"

interface VideoDetailProps {
  detail: VideoDetailType
  showActions: boolean
  onArchiveToggle: () => void
  onDeleteVideo: () => void
  onReadToggle: () => void
  onTagsChange: (tags: string[]) => Promise<void>
}

function stripSummaryHeader(markdown: string | null): string | null {
  if (!markdown) {
    return null
  }

  const lines = markdown.trim().split("\n")
  if (lines[0]?.startsWith("# ")) {
    lines.shift()
  }

  while (lines[0]?.trim() === "") {
    lines.shift()
  }

  const metadataPrefixes = [
    "**URL**:",
    "**Generated**:",
    "**AI Engine**:",
    "**Model**:",
  ]
  while (
    lines.length > 0 &&
    metadataPrefixes.some((prefix) => lines[0].startsWith(prefix))
  ) {
    lines.shift()
  }

  while (lines[0]?.trim() === "") {
    lines.shift()
  }

  if (lines[0]?.trim() === "---") {
    lines.shift()
    while (lines[0]?.trim() === "") {
      lines.shift()
    }
  }

  return lines.join("\n").trim()
}

export function VideoDetail({
  detail,
  showActions,
  onArchiveToggle,
  onDeleteVideo,
  onReadToggle,
  onTagsChange,
}: VideoDetailProps) {
  const metadataItems = [
    formatDate(detail.date),
    detail.metadata?.author,
    detail.metadata?.aiEngine && detail.metadata?.model
      ? `${detail.metadata.aiEngine} / ${detail.metadata.model}`
      : detail.metadata?.aiEngine || detail.metadata?.model,
  ].filter(Boolean)
  const summaryMd = stripSummaryHeader(detail.summaryMd)
  const defaultTab = detail.briefSummaryMd
    ? "brief"
    : summaryMd
      ? "summary"
      : "transcript"

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      {/* Embedded YouTube player */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
        <iframe
          src={`https://www.youtube.com/embed/${detail.videoId}`}
          title={detail.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>

      {/* Info bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">
            <a
              href={`https://www.youtube.com/watch?v=${detail.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {detail.title}
            </a>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {metadataItems.join(" | ")}
          </p>
          <VideoTagEditor tags={detail.tags} onChange={onTagsChange} />
        </div>
        {showActions && (
          <VideoActionsMenu
            detail={detail}
            onArchiveToggle={onArchiveToggle}
            onDelete={onDeleteVideo}
            onReadToggle={onReadToggle}
          />
        )}
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList variant="subtle">
          <TabsTrigger value="brief" disabled={!detail.briefSummaryMd}>
            Brief
          </TabsTrigger>
          <TabsTrigger value="summary" disabled={!summaryMd}>
            Summary
          </TabsTrigger>
          <TabsTrigger value="transcript" disabled={!detail.transcriptMd}>
            Transcript
          </TabsTrigger>
        </TabsList>
        <TabsContent value="brief" className="mt-4">
          {detail.briefSummaryMd ? (
            <Streamdown plugins={{ code }}>
              {detail.briefSummaryMd}
            </Streamdown>
          ) : (
            <p className="text-muted-foreground">No brief summary available.</p>
          )}
        </TabsContent>
        <TabsContent value="summary" className="mt-4">
          {summaryMd ? (
            <Streamdown plugins={{ code }}>
              {summaryMd}
            </Streamdown>
          ) : (
            <p className="text-muted-foreground">No summary available.</p>
          )}
        </TabsContent>
        <TabsContent value="transcript" className="mt-4">
          {detail.transcriptMd ? (
            <Streamdown plugins={{ code }}>
              {detail.transcriptMd}
            </Streamdown>
          ) : (
            <p className="text-muted-foreground">No transcript available.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
