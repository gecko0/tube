import { useCallback, useState } from "react"

export interface UseDialogReturn {
  isOpen: boolean
  open: () => void
  close: () => void
  props: {
    open: boolean
    onOpenChange: (open: boolean) => void
  }
}

export function useDialog(): UseDialogReturn {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  return {
    isOpen,
    open,
    close,
    props: {
      open: isOpen,
      onOpenChange: setIsOpen,
    },
  }
}

export interface UseDialogReturnWithData<T> extends Omit<UseDialogReturn, "open"> {
  data: T | undefined
  open: (data?: T) => void
}

export function useDialogWithData<T>(): UseDialogReturnWithData<T> {
  const [isOpen, setIsOpen] = useState(false)
  const [activeData, setActiveData] = useState<T | undefined>()

  const open = useCallback((data?: T) => {
    setActiveData(data)
    setIsOpen(true)
  }, [])
  const close = useCallback(() => {
    setIsOpen(false)
    setActiveData(undefined)
  }, [])

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setActiveData(undefined)
    }
  }, [])

  return {
    isOpen,
    open,
    close,
    data: activeData,
    props: {
      open: isOpen,
      onOpenChange: handleOpenChange,
    },
  }
}
