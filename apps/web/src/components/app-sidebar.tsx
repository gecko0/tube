import { useEffect, useRef } from "react"
import { Filter } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { NavUser } from "@/components/nav-user"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import type { VideoSummary, VideoView } from "@/lib/types"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  videos: VideoSummary[]
  view: VideoView
  selectedVideoId: string | null
  onSelectVideo: (videoId: string) => void
  onViewChange: (view: VideoView) => void
  loading: boolean
  canLoadMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

export function AppSidebar({
  videos,
  view,
  selectedVideoId,
  onSelectVideo,
  onViewChange,
  loading,
  canLoadMore,
  loadingMore,
  onLoadMore,
  ...props
}: AppSidebarProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!canLoadMore || loadingMore) return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [canLoadMore, loadingMore, onLoadMore])

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Videos
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Filter videos"
                  className={
                    view === "archived"
                      ? "size-8 bg-amber-100 text-amber-950 hover:bg-amber-200 dark:bg-amber-400/20 dark:text-amber-200 dark:hover:bg-amber-400/30"
                      : "size-8"
                  }
                >
                  <Filter className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={view}
                  onValueChange={(value) => onViewChange(value as VideoView)}
                >
                  <DropdownMenuRadioItem value="active">
                    Active
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="archived">
                    Archived
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
                    <span className="text-muted-foreground">
                      {view === "active" ? "No active videos" : "No archived videos"}
                    </span>
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
              {!loading && loadingMore && (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <span className="text-muted-foreground">Loading...</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
            {!loading && canLoadMore && (
              <div ref={sentinelRef} className="h-1" aria-hidden="true" />
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
