import React from 'react'
import { cn } from '../../lib/utils'

const Progress = React.forwardRef(({ className, value = 0, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('relative h-4 w-full overflow-hidden rounded-full bg-gray-100', className)}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-green-600 transition-all rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
})

Progress.displayName = 'Progress'
export { Progress }
