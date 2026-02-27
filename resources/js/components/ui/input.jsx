import React from 'react'
import { cn } from '../../lib/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
        'ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'placeholder:text-gray-400',
        'focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})

Input.displayName = 'Input'
export { Input }
