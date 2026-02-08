import * as React from "react"
import { cn } from "../../lib/utils"

interface PopoverProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const PopoverContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({
  open: false,
  onOpenChange: () => {},
})

export function Popover({ children, open, onOpenChange }: PopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  
  const isControlled = open !== undefined
  const currentOpen = isControlled ? open : internalOpen
  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }

  return (
    <PopoverContext.Provider value={{ open: currentOpen, onOpenChange: handleOpenChange }}>
      <div className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

export function PopoverTrigger({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) {
  const { open, onOpenChange } = React.useContext(PopoverContext)
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent closing immediately
    onOpenChange(!open)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      // aria-expanded: open
    })
  }

  return (
    <div onClick={handleClick}>
      {children}
    </div>
  )
}

export function PopoverContent({ children, className, align = "center" }: { children: React.ReactNode, className?: string, align?: "start" | "center" | "end" }) {
  const { open, onOpenChange } = React.useContext(PopoverContext)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }

    if (open) {
      document.addEventListener("click", handleClickOutside)
    }

    return () => {
      document.removeEventListener("click", handleClickOutside)
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 mt-2 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2",
        "bg-background border-border", // Fallback colors if bg-popover not defined
        align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2",
        className
      )}
    >
      {children}
    </div>
  )
}
