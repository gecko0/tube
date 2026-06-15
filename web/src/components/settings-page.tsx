import { useCallback, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Copy, Key, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
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
import type { Id } from "../../convex/_generated/dataModel"

async function hashKey(rawKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(rawKey)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

function generateRawKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function SettingsPage() {
  const apiKeys = useQuery(api.apiKeys.list)
  const createKey = useMutation(api.apiKeys.create)
  const revokeKey = useMutation(api.apiKeys.revoke)

  const [newKeyName, setNewKeyName] = useState("")
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Id<"apiKeys"> | null>(null)

  const handleGenerate = useCallback(async () => {
    const name = newKeyName.trim() || "CLI Key"
    const rawKey = generateRawKey()
    const keyHash = await hashKey(rawKey)
    await createKey({ keyHash, name })
    setGeneratedKey(rawKey)
    setNewKeyName("")
  }, [newKeyName, createKey])

  const handleCopy = useCallback(async () => {
    if (!generatedKey) return
    await navigator.clipboard.writeText(generatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generatedKey])

  const handleRevoke = useCallback(async () => {
    if (!revokeTarget) return
    await revokeKey({ id: revokeTarget })
    setRevokeTarget(null)
  }, [revokeTarget, revokeKey])

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage API keys for CLI access
        </p>
      </div>

      <Separator />

      {/* Generate new key */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Generate API Key</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Key name (e.g. My Laptop)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
          <Button onClick={handleGenerate}>
            <Plus className="size-4 mr-1" />
            Generate
          </Button>
        </div>
      </div>

      {/* Show generated key */}
      {generatedKey && (
        <div className="rounded-md border bg-muted p-4 space-y-2">
          <p className="text-sm font-medium">Your new API key (shown once):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-background px-3 py-2 text-sm font-mono break-all">
              {generatedKey}
            </code>
            <Button variant="outline" size="icon" onClick={handleCopy}>
              <Copy className="size-4" />
            </Button>
          </div>
          {copied && (
            <p className="text-xs text-green-600">Copied to clipboard!</p>
          )}
          <p className="text-xs text-muted-foreground">
            Run <code className="rounded bg-background px-1">yt connect {generatedKey}</code> to
            connect your CLI.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGeneratedKey(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      <Separator />

      {/* Existing keys */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium">API Keys</h2>
        {apiKeys === undefined ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No API keys yet. Generate one above to connect your CLI.
          </p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((key) => (
              <div
                key={key._id}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Key className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(key._creationTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRevokeTarget(key._id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoke confirmation */}
      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
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
    </div>
  )
}
