import {
  GraduationCap,
  MessageSquare,
  FileText,
  BookOpen,
  Settings,
  LogOut,
  Plus,
  History,
  ClipboardCheck,
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  CalendarCheck,
  Upload,
  Download,
} from 'lucide-react'
import { Button } from './ui/button'
import { Separator } from './ui/separator'

function formatTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Sidebar({
  activeView = 'dashboard',
  onViewChange,
  onLogout,
  conversations = [],
  onNewChat,
  onSelectConversation,
  currentConversationId = null,
  onUploadStudents,
  onDownloadStudents,
  userRole = 'faculty',
}) {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-green-700 text-white flex items-center justify-center">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-semibold">Mentora</h2>
            <p className="text-xs text-gray-500">AI Teaching Assistant</p>
          </div>
        </div>
      </div>

      {activeView === 'chat' && userRole === 'faculty' && (
        <div className="p-3">
          <Button onClick={onNewChat} className="w-full bg-green-700 hover:bg-green-800">
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3">
        <div className="space-y-1">
          <div className="px-2 py-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase">Navigation</p>
          </div>

          {userRole === 'admin' ? (
            <>
              <Button
                variant={activeView === 'admin-dashboard' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('admin-dashboard')}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Button>

              <Button
                variant={activeView === 'admin-students' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('admin-students')}
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                All Students
              </Button>

              <Button
                variant={activeView === 'admin-courses' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('admin-courses')}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                All Courses
              </Button>

              <Button
                variant={activeView === 'admin-materials' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('admin-materials')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Materials Library
              </Button>

              <Button
                variant={activeView === 'admin-faculty' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('admin-faculty')}
              >
                <Users className="w-4 h-4 mr-2" />
                Faculty Members
              </Button>
            </>
          ) : (
            <>
              <Button
                variant={activeView === 'dashboard' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('dashboard')}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Button>

              <Button
                variant={activeView === 'chat' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('chat')}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                AI Chat
              </Button>

              <Button
                variant={activeView === 'materials' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('materials')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Course Materials
              </Button>

              <Button
                variant={activeView === 'courses' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('courses')}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                My Courses
              </Button>

              <Button
                variant={activeView === 'grading' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('grading')}
              >
                <ClipboardCheck className="w-4 h-4 mr-2" />
                Grading
              </Button>

              <Button
                variant={activeView === 'students' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('students')}
              >
                <Users className="w-4 h-4 mr-2" />
                Students
              </Button>

              <Button
                variant={activeView === 'class-record' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('class-record')}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Class Record
              </Button>

              <Button
                variant={activeView === 'attendance' ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onViewChange?.('attendance')}
              >
                <CalendarCheck className="w-4 h-4 mr-2" />
                Attendance
              </Button>
            </>
          )}

          {activeView === 'chat' && userRole === 'faculty' && (
            <>
              <Separator className="my-2" />

              <div className="px-2 py-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                  <History className="w-3 h-3" />
                  Recent Chats
                </p>
              </div>

              {conversations.map((conv) => (
                <Button
                  key={conv.id}
                  variant={currentConversationId === conv.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start text-left"
                  onClick={() => onSelectConversation?.(conv.id)}
                >
                  <div className="flex flex-col items-start overflow-hidden w-full">
                    <span className="text-sm truncate w-full">{conv.title}</span>
                    <span className="text-xs text-gray-500">{formatTimestamp(conv.timestamp || conv.updated_at || conv.created_at)}</span>
                  </div>
                </Button>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-gray-200 space-y-1">
        {userRole === 'faculty' && (
          <div className="mb-3">
            <div className="px-2 py-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase">Student Data</p>
            </div>

            <Button
              variant="ghost"
              className="w-full justify-start text-green-700 hover:text-green-800 hover:bg-green-50"
              onClick={() => {
                document.getElementById('sidebar-excel-upload')?.click()
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Students
            </Button>
            <input
              type="file"
              id="sidebar-excel-upload"
              className="hidden"
              accept=".xlsx, .xls"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file && onUploadStudents) {
                  onUploadStudents(file)
                }
                e.target.value = ''
              }}
            />

            <Button
              variant="ghost"
              className="w-full justify-start text-blue-700 hover:text-blue-800 hover:bg-blue-50"
              onClick={onDownloadStudents}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Students
            </Button>
          </div>
        )}

        {userRole === 'faculty' && <Separator className="my-2" />}

        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => onViewChange?.('settings')}
        >
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  )
}
