import { lazy, Suspense, useState, useEffect, useCallback } from 'react'
import Sidebar from './Sidebar'
import { Toaster } from 'sonner'

const AdminDashboard = lazy(() => import('./AdminDashboard'))
const ChatInterface = lazy(() => import('./ChatInterface'))
const CourseMaterials = lazy(() => import('./CourseMaterials'))
const MyCourses = lazy(() => import('./MyCourses'))
const CreateCourse = lazy(() => import('./CreateCourse'))
const CourseMaterialsViewer = lazy(() => import('./CourseMaterialsViewer'))
const GradingSystem = lazy(() => import('./GradingSystem'))
const ClassRecord = lazy(() => import('./ClassRecord'))
const Attendance = lazy(() => import('./Attendance'))
const Students = lazy(() => import('./Students'))
const AdminStudents = lazy(() => import('./AdminStudents'))
const AdminCourses = lazy(() => import('./AdminCourses'))
const AdminMaterials = lazy(() => import('./AdminMaterials'))
const AdminFaculty = lazy(() => import('./AdminFaculty'))
const Settings = lazy(() => import('./Settings'))
const Profile = lazy(() => import('./Profile'))

function AdminPagePlaceholder({ title }) {
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8">
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          <p className="mt-2 text-gray-500">This admin page is intentionally blank for now.</p>
        </div>
      </div>
    </div>
  )
}

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function DashboardLayout() {
  const [activeView, setActiveView] = useState('dashboard')
  const [userRole, setUserRole] = useState('faculty')
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [selectedCourseForMaterials, setSelectedCourseForMaterials] = useState(null)

  useEffect(() => {
    fetch('/api/user', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => (r.ok ? r.json() : null))
      .then((data) => {
        const email = String(data?.email || '').toLowerCase()
        const role = email === 'admin@mentora.local' ? 'admin' : 'faculty'
        setUserRole(role)
      })
      .catch(() => {
        setUserRole('faculty')
      })
  }, [])

  useEffect(() => {
    if (userRole === 'admin') {
      setActiveView((prev) => (prev === 'dashboard' ? 'admin-dashboard' : prev))
      return
    }

    setActiveView((prev) => (prev === 'admin-dashboard' ? 'dashboard' : prev))
  }, [userRole])

  // Fetch conversations list
  const fetchConversations = useCallback(() => {
    if (userRole !== 'faculty') {
      setConversations([])
      return
    }

    fetch('/api/chat/conversations', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setConversations(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [userRole])

  // Load conversations when switching to chat view
  useEffect(() => {
    if (activeView === 'chat' && userRole === 'faculty') {
      fetchConversations()
    }
  }, [activeView, fetchConversations, userRole])

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
    if (userRole !== 'faculty') return

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

  const handleLogout = async () => {
    try {
      const token = getToken()
      await fetch('/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': token,
          'Accept': 'application/json',
        },
        credentials: 'same-origin',
      })
      window.location.href = '/login'
    } catch {
      window.location.href = '/login'
    }
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
      case 'admin-dashboard':
        return <AdminDashboard />
      case 'admin-students':
        return <AdminStudents />
      case 'admin-courses':
        return <AdminCourses />
      case 'admin-materials':
        return <AdminMaterials />
      case 'admin-faculty':
        return <AdminFaculty />
      case 'dashboard':
        return userRole === 'admin' ? <AdminDashboard /> : <AdminPagePlaceholder title="Dashboard" />
      case 'chat':
        if (userRole !== 'faculty') {
          return <AdminPagePlaceholder title="AI Chat" />
        }
        return (
          <ChatInterface
            key={activeConversationId || 'new'}
            conversationId={activeConversationId}
            onConversationCreated={handleConversationCreated}
          />
        )
      case 'materials':
        if (userRole !== 'faculty') {
          return <AdminPagePlaceholder title="Course Materials" />
        }
        return <CourseMaterials />
      case 'courses':
        if (userRole !== 'faculty') {
          return <AdminPagePlaceholder title="My Courses" />
        }
        return (
          <MyCourses
            onViewMaterials={handleOpenCourseMaterials}
            onCreateCourse={() => setActiveView('create-course')}
          />
        )
      case 'create-course':
        if (userRole !== 'faculty') {
          return <AdminPagePlaceholder title="Create Course" />
        }
        return (
          <CreateCourse
            onBack={() => setActiveView('courses')}
          />
        )
      case 'course-materials-viewer':
        if (userRole !== 'faculty') {
          return <AdminPagePlaceholder title="Course Materials Viewer" />
        }
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
        if (userRole !== 'faculty') {
          return <AdminPagePlaceholder title="Grading" />
        }
        return <GradingSystem />
      case 'class-record':
        if (userRole !== 'faculty') {
          return <AdminPagePlaceholder title="Class Record" />
        }
        return <ClassRecord />
      case 'attendance':
        if (userRole !== 'faculty') {
          return <AdminPagePlaceholder title="Attendance" />
        }
        return <Attendance />
      case 'students':
        if (userRole !== 'faculty') {
          return <AdminPagePlaceholder title="Students" />
        }
        return <Students />
      case 'profile':
        return <Profile />
      case 'settings':
        return <Settings />
      default:
        return userRole === 'admin' ? <AdminDashboard /> : <AdminPagePlaceholder title="Dashboard" />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Toaster richColors position="top-right" />
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        onLogout={handleLogout}
        conversations={conversations}
        currentConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewConversation}
        userRole={userRole}
        onUploadStudents={() => setActiveView('students')}
        onDownloadStudents={() => setActiveView('students')}
      />
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<div className="p-6 text-gray-600">Loading...</div>}>
          {renderContent()}
        </Suspense>
      </main>
    </div>
  )
}
