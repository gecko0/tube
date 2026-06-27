import { useCallback, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { AlertTriangle, Check, Copy, Key, Plus, Trash2 } from "lucide-react"

import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

async function hashKey(rawKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(rawKey)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

function getConvexHttpUrl(): string {
  const configuredUrl = String(import.meta.env.VITE_CONVEX_URL ?? "").replace(
    /\/$/,
    "",
  )

  return configuredUrl.endsWith(".convex.cloud")
    ? configuredUrl.replace(/\.convex\.cloud$/, ".convex.site")
    : configuredUrl
}

function generateRawKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

interface CreateApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onKeyCreated: (key: string) => void
}

function CreateApiKeyDialog({
  open,
  onOpenChange,
  onKeyCreated,
}: CreateApiKeyDialogProps) {
  const createKey = useMutation(api.apiKeys.create)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const handleCreate = useCallback(async () => {
    setCreating(true)
    setError(null)
    try {
      const rawKey = generateRawKey()
      const keyHash = await hashKey(rawKey)
      await createKey({ keyHash, name: name.trim() || "CLI Key" })
      setName("")
      onOpenChange(false)
      onKeyCreated(rawKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key")
    } finally {
      setCreating(false)
    }
  }, [createKey, name, onKeyCreated, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            Create a key for CLI sync. The key is only shown once.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="api-key-name">
            Name
          </label>
          <Input
            id="api-key-name"
            placeholder="My laptop"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreate()
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={creating} onClick={handleCreate}>
            {creating ? "Creating..." : "Create key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewKeyDisplay({
  apiKey,
  onDismiss,
}: {
  apiKey: string
  onDismiss: () => void
}) {
  const convexUrl = getConvexHttpUrl()
  const connectCommand = `yt --connection_key <key> connect ${apiKey} --convex_url ${convexUrl}`
  const [copiedApiKey, setCopiedApiKey] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState(false)

  const handleCopyApiKey = useCallback(async () => {
    await navigator.clipboard.writeText(apiKey)
    setCopiedApiKey(true)
    setTimeout(() => setCopiedApiKey(false), 2000)
  }, [apiKey])

  const handleCopyCommand = useCallback(async () => {
    await navigator.clipboard.writeText(connectCommand)
    setCopiedCommand(true)
    setTimeout(() => setCopiedCommand(false), 2000)
  }, [connectCommand])

  return (
    <div className="rounded-md border border-amber-500/70 bg-amber-50 p-4 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-medium text-amber-950 dark:text-amber-100">
              Save your API key now
            </h3>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              This is the only time it will be shown.
            </p>
          </div>
          <div className="flex gap-2">
            <Input readOnly value={apiKey} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={handleCopyApiKey}
              title="Copy API key"
            >
              {copiedApiKey ? (
                <Check className="size-4 text-green-600" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-amber-950 dark:text-amber-100">
              Convex URL
            </p>
            <code className="block overflow-x-auto rounded bg-background/80 px-2 py-1.5 text-xs text-amber-950 dark:text-amber-100">
              {convexUrl}
            </code>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-950 dark:text-amber-100">
              CLI setup command
            </p>
            <div className="flex items-start gap-2">
              <code className="block min-w-0 flex-1 overflow-x-auto rounded bg-background/80 px-2 py-1.5 font-mono text-xs text-amber-950 dark:text-amber-100">
                {connectCommand}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={handleCopyCommand}
                title="Copy setup command"
              >
                {copiedCommand ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ApiKeysPanel() {
  const apiKeys = useQuery(api.apiKeys.list)
  const revokeKey = useMutation(api.apiKeys.revoke)
  const convexUrl = getConvexHttpUrl()
  const [createOpen, setCreateOpen] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copiedConvexUrl, setCopiedConvexUrl] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Id<"apiKeys"> | null>(null)

  const handleRevoke = useCallback(async () => {
    if (!revokeTarget) return
    await revokeKey({ id: revokeTarget })
    setRevokeTarget(null)
  }, [revokeKey, revokeTarget])

  const handleCopyConvexUrl = useCallback(async () => {
    await navigator.clipboard.writeText(convexUrl)
    setCopiedConvexUrl(true)
    setTimeout(() => setCopiedConvexUrl(false), 2000)
  }, [convexUrl])

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create key
          </Button>
        </div>

        <div className="flex items-center gap-3 rounded-md border px-3 py-2">
          <p className="shrink-0 text-xs font-medium text-muted-foreground">
            Convex URL
          </p>
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs">
            {convexUrl}
          </code>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={handleCopyConvexUrl}
            title="Copy Convex URL"
          >
            {copiedConvexUrl ? (
              <Check className="size-4 text-green-600" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>

        {generatedKey && (
          <NewKeyDisplay
            apiKey={generatedKey}
            onDismiss={() => setGeneratedKey(null)}
          />
        )}

        {apiKeys === undefined ? (
          <p className="text-sm text-muted-foreground">Loading keys...</p>
        ) : apiKeys.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <Key className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No API keys yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((key) => (
              <div
                key={key._id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Key className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {key.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(key._creationTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setRevokeTarget(key._id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onKeyCreated={setGeneratedKey}
      />

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(isOpen) => !isOpen && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any CLI using this key will no longer be able to sync. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleRevoke}>
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
