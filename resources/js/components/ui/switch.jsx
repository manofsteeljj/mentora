import { useState } from 'react'
import { cn } from '../../lib/utils'

function Switch({ defaultChecked = false, checked, onCheckedChange, className, ...props }) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked)
  const isChecked = checked !== undefined ? checked : internalChecked

  const handleToggle = () => {
    const newValue = !isChecked
    if (checked === undefined) {
      setInternalChecked(newValue)
    }
    onCheckedChange?.(newValue)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      onClick={handleToggle}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        isChecked ? 'bg-green-700' : 'bg-gray-200',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
          isChecked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  )
}

export { Switch }
