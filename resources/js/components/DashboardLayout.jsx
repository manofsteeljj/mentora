import { lazy, Suspense, useState, useEffect, useCallback } from 'react'
import Sidebar from './Sidebar'
import { Toaster } from 'sonner'

const Dashboard = lazy(() => import('./Dashboard'))
const ChatInterface = lazy(() => import('./ChatInterface'))
const CourseMaterials = lazy(() => import('./CourseMaterials'))
const MyCourses = lazy(() => import('./MyCourses'))
const CreateCourse = lazy(() => import('./CreateCourse'))
const CourseMaterialsViewer = lazy(() => import('./CourseMaterialsViewer'))
const GradingSystem = lazy(() => import('./GradingSystem'))
const ClassRecord = lazy(() => import('./ClassRecord'))
const Attendance = lazy(() => import('./Attendance'))
const Students = lazy(() => import('./Students'))
const Settings = lazy(() => import('./Settings'))
const Profile = lazy(() => import('./Profile'))

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function DashboardLayout() {
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [selectedCourseForMaterials, setSelectedCourseForMaterials] = useState(null)

  // Fetch conversations list
  const fetchConversations = useCallback(() => {
    fetch('/api/chat/conversations', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setConversations(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // Load conversations when switching to chat view
  useEffect(() => {
    if (activeView === 'chat') {
      fetchConversations()
    }
  }, [activeView, fetchConversations])

  const handleSelectConversation = (id) => {
    setActiveConversationId(id)
  }

  const handleNewConversation = () => {
    setActiveConversationId(null) // null = new chat (no existing conversation)
  }

  const handleConversationCreated = (newId) => {
    // A new conversation was created by ChatInterface — refresh list and set active
    setActiveConversationId(newId)
    fetchConversations()
  }

  const handleDeleteConversation = async (id) => {
    try {
      await fetch(`/api/chat/conversations/${id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
      })
      // If we deleted the active one, reset to new chat
      if (activeConversationId === id) {
        setActiveConversationId(null)
      }
      fetchConversations()
    } catch {}
  }

  const handleViewChange = (view) => {
    setActiveView(view)
    if (view !== 'course-materials-viewer') {
      setSelectedCourseForMaterials(null)
    }
    if (view !== 'chat') {
      setActiveConversationId(null)
    }
  }

  const handleOpenCourseMaterials = (course) => {
    setSelectedCourseForMaterials(course)
    setActiveView('course-materials-viewer')
  }

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />
      case 'chat':
        return (
          <ChatInterface
            key={activeConversationId || 'new'}
            conversationId={activeConversationId}
            onConversationCreated={handleConversationCreated}
          />
        )
      case 'materials':
        return <CourseMaterials />
      case 'courses':
        return (
          <MyCourses
            onViewMaterials={handleOpenCourseMaterials}
            onCreateCourse={() => setActiveView('create-course')}
          />
        )
      case 'create-course':
        return (
          <CreateCourse
            onBack={() => setActiveView('courses')}
          />
        )
      case 'course-materials-viewer':
        if (!selectedCourseForMaterials) {
          return (
            <MyCourses
              onViewMaterials={handleOpenCourseMaterials}
              onCreateCourse={() => setActiveView('create-course')}
            />
          )
        }
        return (
          <CourseMaterialsViewer
            courseId={selectedCourseForMaterials.id}
            courseName={selectedCourseForMaterials.name}
            courseCode={selectedCourseForMaterials.code}
            onBack={() => {
              setActiveView('courses')
              setSelectedCourseForMaterials(null)
            }}
          />
        )
      case 'grading':
        return <GradingSystem />
      case 'class-record':
        return <ClassRecord />
      case 'attendance':
        return <Attendance />
      case 'students':
        return <Students />
      case 'profile':
        return <Profile />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Toaster richColors position="top-right" />
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<div className="p-6 text-gray-600">Loading...</div>}>
          {renderContent()}
        </Suspense>
      </main>
    </div>
  )
}
