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
  loading: boolean
}

export function AppSidebar({
  videos,
  selectedVideoId,
  onSelectVideo,
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
                  <SidebarMenuItem key={video.video_id}>
                    <SidebarMenuButton
                      isActive={selectedVideoId === video.video_id}
                      onClick={() => onSelectVideo(video.video_id)}
                      className="h-auto py-2"
                    >
                      <div className="flex items-start gap-3 w-full">
                        <img
                          src={video.thumbnail_url}
                          alt=""
                          className="w-20 min-w-20 rounded-sm object-cover aspect-video"
                        />
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-sm font-medium leading-tight truncate">
                            {video.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {video.date}
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
        <ThemeSwitcher />
      </SidebarFooter>
    </Sidebar>
  )
}
