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
  Plus,
  Trash2,
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

function timeAgo(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now - date) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export default function Sidebar({
  activeView = 'dashboard',
  onViewChange,
  collapsed = false,
  onToggleCollapse,
  conversations = [],
  activeConversationId = null,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) {
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Recent Chats
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onNewConversation}
                  title="New chat"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="space-y-0.5">
                {conversations.length === 0 ? (
                  <p className="text-xs text-gray-400 px-2 py-1">No conversations yet</p>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        'group flex items-center gap-1 rounded-md transition-colors',
                        activeConversationId === conv.id
                          ? 'bg-green-50'
                          : 'hover:bg-gray-100'
                      )}
                    >
                      <button
                        className={cn(
                          'flex-1 text-left px-2 py-1.5 text-sm truncate',
                          activeConversationId === conv.id
                            ? 'text-green-800 font-medium'
                            : 'text-gray-600 hover:text-gray-900'
                        )}
                        onClick={() => onSelectConversation?.(conv.id)}
                        title={conv.title}
                      >
                        {conv.title}
                      </button>
                      <button
                        className="hidden group-hover:flex items-center justify-center h-6 w-6 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 mr-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteConversation?.(conv.id)
                        }}
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
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
