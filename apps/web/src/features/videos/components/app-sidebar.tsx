import {
  Archive,
  Folder,
  Inbox,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { NavUser } from "@/components/nav-user"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useState, type DragEvent } from "react"
import type { Id } from "../../../../convex/_generated/dataModel"
import type { VideoDropTarget } from "@/features/videos/types"
import type { FolderScope, FolderSummary } from "@/lib/types"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  folders: FolderSummary[]
  folderScope: FolderScope
  dropTargetKey: string | null
  onFolderScopeChange: (scope: FolderScope) => void
  onCreateFolder: () => void
  onRenameFolder: (folder: FolderSummary) => void
  onDeleteFolder: (folder: FolderSummary) => void
  onFolderDragOver: (event: DragEvent, target: VideoDropTarget) => void
  onFolderDragLeave: () => void
  onFolderDrop: (event: DragEvent, target: VideoDropTarget) => void
}

function scopeKey(scope: FolderScope) {
  return scope.kind === "folder" ? scope.folderId : scope.kind
}

function FolderDropButton({
  active,
  dropActive,
  icon,
  label,
  count,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
  action,
  hideCount,
}: {
  active: boolean
  dropActive: boolean
  icon: React.ReactNode
  label: string
  count?: number
  hideCount?: boolean
  onClick: () => void
  onDragOver: (event: DragEvent) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent) => void
  action?: React.ReactNode
}) {
  return (
    <SidebarMenuItem
      className={cn(
        "group/folder rounded-md",
        dropActive && "bg-primary/10 ring-1 ring-primary/40"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <SidebarMenuButton isActive={active} onClick={onClick}>
        {icon}
        <span className="truncate">{label}</span>
      </SidebarMenuButton>
      {count !== undefined && (
        <SidebarMenuBadge
          className={cn(
            "group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0",
            hideCount && "opacity-0"
          )}
        >
          {count}
        </SidebarMenuBadge>
      )}
      {action}
    </SidebarMenuItem>
  )
}

export function AppSidebar({
  folders,
  folderScope,
  dropTargetKey,
  onFolderScopeChange,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  ...props
}: AppSidebarProps) {
  const currentScopeKey = scopeKey(folderScope)
  const [openFolderActionId, setOpenFolderActionId] =
    useState<Id<"folders"> | null>(null)

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex h-12 items-center px-2">
            <Logo className="h-7" />
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <FolderDropButton
                active={currentScopeKey === "all"}
                dropActive={false}
                icon={<Video className="size-4" />}
                label="All videos"
                onClick={() => onFolderScopeChange({ kind: "all" })}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={onFolderDragLeave}
                onDrop={(event) => event.preventDefault()}
              />
              <FolderDropButton
                active={currentScopeKey === "inbox"}
                dropActive={dropTargetKey === "inbox"}
                icon={<Inbox className="size-4" />}
                label="Inbox"
                onClick={() => onFolderScopeChange({ kind: "inbox" })}
                onDragOver={(event) => onFolderDragOver(event, "inbox")}
                onDragLeave={onFolderDragLeave}
                onDrop={(event) => onFolderDrop(event, "inbox")}
              />
              <FolderDropButton
                active={currentScopeKey === "archived"}
                dropActive={dropTargetKey === "archived"}
                icon={<Archive className="size-4" />}
                label="Archived"
                onClick={() => onFolderScopeChange({ kind: "archived" })}
                onDragOver={(event) => onFolderDragOver(event, "archived")}
                onDragLeave={onFolderDragLeave}
                onDrop={(event) => onFolderDrop(event, "archived")}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Library
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Create folder"
              className="-mr-1 size-5"
              onClick={onCreateFolder}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {folders.map((folder) => (
                <FolderDropButton
                  key={folder._id}
                  active={currentScopeKey === folder._id}
                  dropActive={dropTargetKey === folder._id}
                  icon={<Folder className="size-4" />}
                  label={folder.name}
                  count={folder.videoCount}
                  hideCount={openFolderActionId === folder._id}
                  onClick={() =>
                    onFolderScopeChange({ kind: "folder", folderId: folder._id })
                  }
                  onDragOver={(event) => onFolderDragOver(event, folder._id)}
                  onDragLeave={onFolderDragLeave}
                  onDrop={(event) => onFolderDrop(event, folder._id)}
                  action={
                    <DropdownMenu
                      open={openFolderActionId === folder._id}
                      onOpenChange={(open) =>
                        setOpenFolderActionId(open ? folder._id : null)
                      }
                    >
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction
                          showOnHover
                          aria-label={`Folder actions for ${folder.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onRenameFolder(folder)}>
                          <Pencil />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => onDeleteFolder(folder)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                />
              ))}
              {folders.length === 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <span className="text-muted-foreground">No folders</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
