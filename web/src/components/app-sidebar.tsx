import { formatDate } from "@/lib/utils"
import { UserButton } from "@clerk/react"
import { Settings } from "lucide-react"
import { ThemeSwitcher } from "@/components/theme-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { VideoSummary } from "@/lib/types"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  videos: VideoSummary[]
  selectedVideoId: string | null
  onSelectVideo: (videoId: string) => void
  onOpenSettings: () => void
  loading: boolean
}

export function AppSidebar({
  videos,
  selectedVideoId,
  onSelectVideo,
  onOpenSettings,
  loading,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <span className="text-muted-foreground">Loading...</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : videos.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <span className="text-muted-foreground">No videos yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                videos.map((video) => (
                  <SidebarMenuItem key={video.videoId}>
                    <SidebarMenuButton
                      isActive={selectedVideoId === video.videoId}
                      onClick={() => onSelectVideo(video.videoId)}
                      className="h-auto py-2"
                    >
                      <div className="flex items-start gap-3 w-full">
                        <img
                          src={video.thumbnailUrl}
                          alt=""
                          className="w-20 min-w-20 rounded-sm object-cover aspect-video"
                        />
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-sm font-medium leading-tight truncate">
                            {video.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(video.date)}
                          </span>
                        </div>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1">
          <UserButton />
          <button
            onClick={onOpenSettings}
            className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title="Settings"
          >
            <Settings className="size-4" />
          </button>
        </div>
        <ThemeSwitcher />
      </SidebarFooter>
    </Sidebar>
  )
}
