import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './ui/input'

export default function PasswordInput({ className, leadingIcon, ...props }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      {leadingIcon}
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${className || ''} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  )
}
