import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { api } from "../../../convex/_generated/api"
import { FormFieldExt } from "@/components/form-field-ext"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { useDialog } from "@/hooks/use-dialog"
import type { VideoDetail } from "@/lib/types"

const videoRenameSchema = z.object({
  title: z.string().trim().min(1, "Video title is required"),
})

type VideoRenameValues = z.infer<typeof videoRenameSchema>

export function VideoRenameDialog({
  detail,
  dialog,
}: {
  detail: VideoDetail
  dialog: ReturnType<typeof useDialog>
}) {
  const [isSaving, setIsSaving] = useState(false)
  const renameVideo = useMutation(api.videos.rename)
  const form = useForm<VideoRenameValues>({
    resolver: zodResolver(videoRenameSchema),
    mode: "onChange",
    defaultValues: { title: detail.title },
  })

  useEffect(() => {
    if (dialog.isOpen) {
      form.reset({ title: detail.title })
      setIsSaving(false)
    }
  }, [detail.title, dialog.isOpen, form])

  const canSubmit = useMemo(
    () => form.formState.isValid && !isSaving,
    [form.formState.isValid, isSaving]
  )
  const handleSubmit = form.handleSubmit(async ({ title }) => {
    setIsSaving(true)
    try {
      await renameVideo({ videoId: detail.videoId, title })
      dialog.close()
    } finally {
      setIsSaving(false)
    }
  })

  return (
    <Dialog {...dialog.props}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename video</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormFieldExt
              control={form.control}
              name="title"
              label="Title"
              render={({ field }) => (
                <Input
                  {...field}
                  autoFocus
                  placeholder="Video title"
                  disabled={isSaving}
                />
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={dialog.close}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
