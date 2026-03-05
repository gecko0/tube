import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})(\d{2})$/)
  if (match) {
    const [, date, hours, minutes] = match
    return `${date} ${hours}:${minutes}`
  }
  return dateStr
}
