import { SidebarTrigger } from "@/components/ui/sidebar"

export function VideosHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center px-4">
      <SidebarTrigger className="-ml-1" />
    </header>
  )
}
