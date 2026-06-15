import { KeyRound, Monitor, Moon, Settings, Sun } from "lucide-react"

import { ApiKeysPanel } from "@/components/api-keys-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTheme } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"

export type UserSettingsSectionId = "general" | "api-keys"

const sections = [
  { id: "general" as const, label: "General", icon: Settings },
  { id: "api-keys" as const, label: "API keys", icon: KeyRound },
]

const themeOptions = [
  {
    id: "light" as const,
    label: "Light",
    icon: Sun,
  },
  {
    id: "dark" as const,
    label: "Dark",
    icon: Moon,
  },
  {
    id: "system" as const,
    label: "System",
    icon: Monitor,
  },
]

function GeneralSection() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">General</h2>
        <p className="text-sm text-muted-foreground">
          Configure your app preferences.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Theme</h3>
          <p className="text-sm text-muted-foreground">
            Choose how the web app should appear.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={theme === option.id ? "secondary" : "outline"}
              className={cn(
                "h-20 flex-col gap-2",
                theme === option.id && "ring-2 ring-ring/30"
              )}
              onClick={() => setTheme(option.id)}
            >
              <option.icon className="size-5" />
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function UserSettingsDialog({
  open,
  onOpenChange,
  section,
  onSectionChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: UserSettingsSectionId
  onSectionChange: (section: UserSettingsSectionId) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">User settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your preferences and API keys.
        </DialogDescription>
        <div className="flex h-[520px] min-w-0">
          <nav className="flex w-44 shrink-0 flex-col gap-1 border-r bg-muted/30 p-2">
            {sections.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                className={cn(
                  "h-8 justify-start gap-2",
                  section === item.id && "bg-accent text-accent-foreground"
                )}
                onClick={() => onSectionChange(item.id)}
              >
                <item.icon className="size-4" />
                {item.label}
              </Button>
            ))}
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {section === "general" && <GeneralSection />}
            {section === "api-keys" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">API keys</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage keys for syncing transcripts from the CLI.
                  </p>
                </div>
                <ApiKeysPanel />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
