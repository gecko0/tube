import type { Id } from "../../../convex/_generated/dataModel"

export const VIDEO_DRAG_TYPE = "application/x-tube-video-ids"

export type VideoDropTarget = "inbox" | "archived" | Id<"folders">
