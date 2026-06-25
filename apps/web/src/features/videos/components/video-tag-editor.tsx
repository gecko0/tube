import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface VideoTagEditorProps {
  tags: string[]
  onChange: (tags: string[]) => Promise<void>
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/^#+/, "").replace(/\s+/g, " ")
}

function normalizeTags(tags: string[]) {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const rawTag of tags) {
    const tag = normalizeTag(rawTag)
    if (!tag || seen.has(tag)) {
      continue
    }
    seen.add(tag)
    normalized.push(tag)
    if (normalized.length >= 8) {
      break
    }
  }

  return normalized
}

export function VideoTagEditor({ tags, onChange }: VideoTagEditorProps) {
  const [draftTags, setDraftTags] = useState(tags)
  const [inputValue, setInputValue] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const canAddMore = draftTags.length < 8
  const placeholder = useMemo(
    () => (canAddMore ? "Add a tag" : "8 tags max"),
    [canAddMore]
  )

  useEffect(() => {
    setDraftTags(tags)
    setInputValue("")
    setIsSaving(false)
  }, [tags])

  const commitTags = async (nextTags: string[]) => {
    const normalized = normalizeTags(nextTags)
    setDraftTags(normalized)
    setIsSaving(true)
    try {
      await onChange(normalized)
    } finally {
      setIsSaving(false)
    }
  }

  const addInputTags = async () => {
    const nextInputTags = inputValue
      .split(",")
      .map(normalizeTag)
      .filter(Boolean)
    if (nextInputTags.length === 0) {
      setInputValue("")
      return
    }

    setInputValue("")
    await commitTags([...draftTags, ...nextInputTags])
  }

  const removeTag = async (tagToRemove: string) => {
    await commitTags(draftTags.filter((tag) => tag !== tagToRemove))
  }

  return (
    <div
      className={cn(
        "mt-3 flex min-h-8 flex-wrap items-center gap-2 text-sm",
        isSaving && "opacity-70"
      )}
    >
      {draftTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex h-8 max-w-full items-center gap-2 rounded-md bg-secondary px-2.5 text-sm font-medium text-secondary-foreground"
        >
          <span className="truncate">{tag}</span>
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            disabled={isSaving}
            onClick={() => void removeTag(tag)}
            className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <input
        value={inputValue}
        disabled={!canAddMore || isSaving}
        onChange={(event) => setInputValue(event.target.value)}
        onBlur={() => void addInputTags()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault()
            void addInputTags()
          }
          if (
            event.key === "Backspace" &&
            inputValue === "" &&
            draftTags.length > 0
          ) {
            event.preventDefault()
            void removeTag(draftTags[draftTags.length - 1])
          }
        }}
        placeholder={placeholder}
        className="h-8 min-w-24 flex-1 border-0 bg-transparent px-0 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  )
}
