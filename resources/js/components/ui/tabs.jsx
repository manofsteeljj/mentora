import React, { useState } from 'react'
import { cn } from '../../lib/utils'

const TabsContext = React.createContext({})

function Tabs({ children, value, onValueChange, defaultValue, className }) {
  const [selected, setSelected] = useState(value || defaultValue || '')

  React.useEffect(() => {
    if (value !== undefined) setSelected(value)
  }, [value])

  function handleChange(val) {
    setSelected(val)
    if (onValueChange) onValueChange(val)
  }

  return (
    <TabsContext.Provider value={{ selected, handleChange }}>
      <div className={cn(className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ children, className }) {
  return (
    <div className={cn(
      'inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500',
      className
    )}>
      {children}
    </div>
  )
}

function TabsTrigger({ children, value, className }) {
  const { selected, handleChange } = React.useContext(TabsContext)
  const isActive = selected === value

  return (
    <button
      type="button"
      onClick={() => handleChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
        'ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2',
        isActive
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-900',
        className
      )}
    >
      {children}
    </button>
  )
}

function TabsContent({ children, value, className }) {
  const { selected } = React.useContext(TabsContext)
  if (selected !== value) return null
  return <div className={cn(className)}>{children}</div>
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
