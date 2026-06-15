import { useState } from "react"
import { useClerk, useUser } from "@clerk/react"
import { ChevronsUpDown, KeyRound, LogOut, Settings } from "lucide-react"

import {
  UserSettingsDialog,
  type UserSettingsSectionId,
} from "@/components/user-settings-dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const { signOut } = useClerk()
  const { user } = useUser()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<UserSettingsSectionId>("general")

  const name = user?.fullName ?? user?.firstName ?? "User"
  const email = user?.primaryEmailAddress?.emailAddress ?? ""
  const avatar = user?.imageUrl ?? ""
  const initials = getInitials(name) || "U"

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <Avatar className="size-6 rounded-md">
                  <AvatarImage src={avatar} alt={name} />
                  <AvatarFallback className="rounded-md text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage src={avatar} alt={name} />
                    <AvatarFallback className="rounded-lg">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    {email && (
                      <span className="truncate text-xs text-muted-foreground">
                        {email}
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => {
                    setSettingsSection("general")
                    setSettingsOpen(true)
                  }}
                >
                  <Settings />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSettingsSection("api-keys")
                    setSettingsOpen(true)
                  }}
                >
                  <KeyRound />
                  API keys
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ redirectUrl: "/" })}>
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <UserSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        section={settingsSection}
        onSectionChange={setSettingsSection}
      />
    </>
  )
}
