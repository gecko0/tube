import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
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
import { FormFieldExt } from "@/components/form-field-ext"
import type { FolderSummary } from "@/lib/types"

const folderFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Folder name is required")
    .max(80, "Folder name must be 80 characters or less"),
})

type FolderFormValues = z.infer<typeof folderFormSchema>

interface FolderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder?: FolderSummary
  onSubmit: (values: FolderFormValues) => Promise<void>
}

export function FolderFormDialog({
  open,
  onOpenChange,
  folder,
  onSubmit,
}: FolderFormDialogProps) {
  const [isSaving, setIsSaving] = useState(false)
  const isEditing = Boolean(folder)
  const form = useForm<FolderFormValues>({
    resolver: zodResolver(folderFormSchema),
    mode: "onChange",
    defaultValues: { name: folder?.name ?? "" },
  })

  useEffect(() => {
    if (open) {
      form.reset({ name: folder?.name ?? "" })
      setIsSaving(false)
    }
  }, [folder, form, open])

  const title = isEditing ? "Rename folder" : "Create folder"
  const actionLabel = isEditing ? "Save changes" : "Create folder"
  const canSubmit = useMemo(
    () => form.formState.isValid && !isSaving,
    [form.formState.isValid, isSaving]
  )

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSaving(true)
    try {
      await onSubmit(values)
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormFieldExt
              control={form.control}
              name="name"
              label="Name"
              render={({ field }) => (
                <Input
                  {...field}
                  autoFocus
                  placeholder="Folder name"
                  disabled={isSaving}
                />
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {isSaving ? "Saving..." : actionLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
