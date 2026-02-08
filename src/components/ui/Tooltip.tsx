import * as React from "react"
import { cn } from "../../lib/utils"

interface TooltipProps {
  children: React.ReactNode
}

const TooltipContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
}>({
  open: false,
  setOpen: () => {},
})

export function Tooltip({ children }: TooltipProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div 
        className="relative inline-block"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  )
}

export function TooltipTrigger({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return children
  }

  return (
    <div>
      {children}
    </div>
  )
}

export function TooltipContent({ children, className }: { children: React.ReactNode, className?: string }) {
  const { open } = React.useContext(TooltipContext)

  if (!open) return null

  return (
    <div
      className={cn(
        "absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-md border bg-background text-foreground shadow-lg text-xs min-w-max",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
    >
      {children}
    </div>
  )
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
