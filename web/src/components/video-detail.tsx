import { Streamdown } from "streamdown"
import { code } from "@streamdown/code"
import "streamdown/styles.css"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import type { VideoDetail as VideoDetailType } from "@/lib/types"

interface VideoDetailProps {
  detail: VideoDetailType
}

export function VideoDetail({ detail }: VideoDetailProps) {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      {/* Embedded YouTube player */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
        <iframe
          src={`https://www.youtube.com/embed/${detail.video_id}`}
          title={detail.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>

      {/* Info bar */}
      <div>
        <h1 className="text-xl font-semibold">
          <a
            href={`https://www.youtube.com/watch?v=${detail.video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {detail.title}
          </a>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {detail.date}
        </p>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue={detail.summary_md ? "summary" : "transcript"}>
        <TabsList>
          <TabsTrigger value="summary" disabled={!detail.summary_md}>
            Summary
          </TabsTrigger>
          <TabsTrigger value="transcript" disabled={!detail.transcript_md}>
            Transcript
          </TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4">
          {detail.summary_md ? (
            <Streamdown plugins={{ code }}>
              {detail.summary_md}
            </Streamdown>
          ) : (
            <p className="text-muted-foreground">No summary available.</p>
          )}
        </TabsContent>
        <TabsContent value="transcript" className="mt-4">
          {detail.transcript_md ? (
            <Streamdown plugins={{ code }}>
              {detail.transcript_md}
            </Streamdown>
          ) : (
            <p className="text-muted-foreground">No transcript available.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
