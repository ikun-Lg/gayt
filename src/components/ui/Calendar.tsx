import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek } from "date-fns"
import { cn } from "../../lib/utils"
import { Button } from "./Button"

export type CalendarProps = {
  mode?: "single" | "range" | "multiple"
  selected?: Date | undefined
  onSelect?: (date: Date | undefined) => void
  initialFocus?: boolean
  className?: string
}

export function Calendar({
  mode = "single",
  selected,
  onSelect,
  className,
  ...props
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(selected || new Date())
  
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  })

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  const handleDateClick = (date: Date) => {
    if (onSelect) {
        if (selected && isSameDay(date, selected)) {
            onSelect(undefined); // toggle off
        } else {
            onSelect(date);
        }
    }
  }

  return (
    <div className={cn("p-3", className)} {...props}>
      <div className="flex items-center justify-between space-y-0 pb-4">
        <h4 className="text-sm font-medium pt-1 pl-1">
            {format(currentMonth, "MMMM yyyy")}
        </h4>
        <div className="flex items-center space-x-1">
            <Button variant="ghost" className="h-7 w-7 p-0" onClick={handlePreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" className="h-7 w-7 p-0" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center">
         {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
             <div key={day} className="text-xs text-muted-foreground font-normal mb-1">
                 {day}
             </div>
         ))}
         {days.map((day, i) => {
             const isSelected = selected ? isSameDay(day, selected) : false;
             const isCurrentMonth = isSameMonth(day, currentMonth);
             const isDateToday = isToday(day);

             return (
                 <button
                    key={day.toISOString()}
                    onClick={() => handleDateClick(day)}
                    className={cn(
                        "h-7 w-7 p-0 font-normal text-xs rounded-md flex items-center justify-center transition-colors",
                         !isCurrentMonth && "text-muted-foreground opacity-50",
                         isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                         !isSelected && isDateToday && "bg-accent text-accent-foreground",
                         !isSelected && !isDateToday && "hover:bg-accent/50 hover:text-accent-foreground"
                    )}
                 >
                     {format(day, "d")}
                 </button>
             )
         })}
      </div>
    </div>
  )
}
