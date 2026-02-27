import React, { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'

const SelectContext = React.createContext({})

function Select({ children, value, onValueChange, defaultValue }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(value || defaultValue || '')
  const ref = useRef(null)

  useEffect(() => {
    if (value !== undefined) setSelected(value)
  }, [value])

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(val) {
    setSelected(val)
    setOpen(false)
    if (onValueChange) onValueChange(val)
  }

  return (
    <SelectContext.Provider value={{ open, setOpen, selected, handleSelect }}>
      <div ref={ref} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

function SelectTrigger({ children, className, ...props }) {
  const { open, setOpen, selected } = React.useContext(SelectContext)
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
        'ring-offset-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
      <svg className="h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6"/>
      </svg>
    </button>
  )
}

function SelectValue({ placeholder }) {
  const { selected } = React.useContext(SelectContext)
  const [label, setLabel] = useState('')
  // The label will be set by SelectItem when it matches
  return <span className={!selected ? 'text-gray-400' : ''}>{label || selected || placeholder}</span>
}

function SelectContent({ children, className }) {
  const { open } = React.useContext(SelectContext)
  if (!open) return null
  return (
    <div className={cn(
      'absolute z-50 mt-1 w-full min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white shadow-md animate-in',
      className
    )}>
      <div className="max-h-60 overflow-y-auto p-1">
        {children}
      </div>
    </div>
  )
}

function SelectItem({ children, value, className }) {
  const { selected, handleSelect } = React.useContext(SelectContext)
  const isSelected = selected === value
  return (
    <div
      onClick={() => handleSelect(value)}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none',
        'hover:bg-gray-100',
        isSelected && 'bg-gray-100 font-medium',
        className
      )}
    >
      {children}
    </div>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
