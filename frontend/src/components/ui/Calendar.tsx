import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

type CalendarProps = {
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  disabled?: (date: Date) => boolean
}

export function Calendar({ selected, onSelect, disabled }: CalendarProps) {
  return (
    <div className="rdp-dark">
      <DayPicker
        mode="single"
        captionLayout="dropdown"
        startMonth={new Date()}
        endMonth={new Date(new Date().getFullYear() + 2, 11)}
        selected={selected}
        onSelect={onSelect}
        disabled={disabled}
        style={{
          '--rdp-accent-color': '#f97316',
          '--rdp-accent-background-color': '#f9731620',
          '--rdp-day-height': '36px',
          '--rdp-day-width': '36px',
          '--rdp-day_button-height': '32px',
          '--rdp-day_button-width': '32px',
        } as React.CSSProperties}
        classNames={{
          root: 'text-sm',
          months: 'flex flex-col',
          month: 'space-y-2',
          month_caption: 'flex justify-center items-center h-8',
          caption_label: 'text-sm font-medium hidden',
          dropdowns: 'flex items-center gap-2 justify-center',
          dropdown: 'bg-surface-2 border border-border rounded-md px-2 py-1 text-xs text-text cursor-pointer focus:outline-none focus:border-primary',
          nav: 'flex items-center gap-1',
          button_previous: 'absolute left-1 top-0 h-8 w-8 flex items-center justify-center rounded-md hover:bg-surface-2 cursor-pointer',
          button_next: 'absolute right-1 top-0 h-8 w-8 flex items-center justify-center rounded-md hover:bg-surface-2 cursor-pointer',
          weekdays: 'flex',
          weekday: 'w-9 text-center text-[10px] font-medium text-text-secondary',
          week: 'flex',
          day: 'w-9 h-9 flex items-center justify-center',
          day_button: 'w-8 h-8 rounded-md text-xs font-medium hover:bg-surface-2 cursor-pointer transition-colors',
          selected: '!bg-primary !text-white hover:!bg-primary-hover',
          today: 'font-bold text-primary',
          disabled: 'opacity-30 cursor-not-allowed hover:bg-transparent',
          outside: 'opacity-40',
        }}
      />
    </div>
  )
}
