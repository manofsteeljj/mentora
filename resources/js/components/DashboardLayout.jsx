import { useState, useEffect, useCallback } from 'react'
import Sidebar from './Sidebar'
import Dashboard from './Dashboard'
import ChatInterface from './ChatInterface'
import CourseMaterials from './CourseMaterials'
import MyCourses from './MyCourses'
import CourseMaterialsViewer from './CourseMaterialsViewer'
import GradingSystem from './GradingSystem'
import Students from './Students'
import Settings from './Settings'
import Profile from './Profile'

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
        return <MyCourses onViewMaterials={handleOpenCourseMaterials} />
      case 'course-materials-viewer':
        if (!selectedCourseForMaterials) return <MyCourses onViewMaterials={handleOpenCourseMaterials} />
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
        {renderContent()}
      </main>
    </div>
  )
}
