import { useState } from 'react'
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  BookOpen,
  ClipboardCheck,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from 'lucide-react'
import { Button } from './ui/button'
import { Separator } from './ui/separator'
import { cn } from '../lib/utils'

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'materials', label: 'Course Materials', icon: FileText },
  { id: 'courses', label: 'My Courses', icon: BookOpen },
  { id: 'grading', label: 'Grading', icon: ClipboardCheck },
  { id: 'students', label: 'Students', icon: Users },
]

const recentChats = [
  { id: '1', title: 'Help with React hooks', timestamp: '2 hours ago' },
  { id: '2', title: 'Database normalization', timestamp: '1 day ago' },
  { id: '3', title: 'Algorithm complexity', timestamp: '3 days ago' },
]

export default function Sidebar({ activeView = 'dashboard', onViewChange, collapsed = false, onToggleCollapse }) {
  const handleLogout = async () => {
    try {
      const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
      await fetch('/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': token || '',
          'Accept': 'application/json',
        },
        credentials: 'same-origin',
      })
      window.location.href = '/login'
    } catch {
      window.location.href = '/login'
    }
  }

  return (
    <div className={cn(
      'flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo / Brand */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-700 text-white">
          <GraduationCap className="h-5 w-5" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold text-green-800">Mentora</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn('ml-auto h-8 w-8', collapsed && 'ml-0')}
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id
            return (
              <Button
                key={item.id}
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start gap-3 h-10',
                  isActive && 'bg-green-50 text-green-800 hover:bg-green-100',
                  collapsed && 'justify-center px-2'
                )}
                onClick={() => onViewChange?.(item.id)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            )
          })}
        </div>

        {/* Recent Chats */}
        {!collapsed && activeView === 'chat' && (
          <>
            <Separator className="my-3" />
            <div className="px-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Recent Chats
              </p>
              <div className="space-y-1">
                {recentChats.map((chat) => (
                  <button
                    key={chat.id}
                    className="w-full text-left px-2 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors truncate"
                  >
                    {chat.title}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-gray-200 px-2 py-2 space-y-1">
        <Button
          variant="ghost"
          className={cn('w-full justify-start gap-3 h-10', collapsed && 'justify-center px-2')}
          onClick={() => onViewChange?.('settings')}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Button>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 h-10 text-red-600 hover:text-red-700 hover:bg-red-50',
            collapsed && 'justify-center px-2'
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </div>
    </div>
  )
}
