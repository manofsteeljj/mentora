import { useState, useEffect, useCallback } from 'react'
import Sidebar from './Sidebar'
import Dashboard from './Dashboard'
import ChatInterface from './ChatInterface'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function DashboardLayout() {
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)

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
    if (view !== 'chat') {
      setActiveConversationId(null)
    }
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
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Course Materials</h2>
              <p className="text-sm">Materials feature coming soon...</p>
            </div>
          </div>
        )
      case 'courses':
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">My Courses</h2>
              <p className="text-sm">Courses feature coming soon...</p>
            </div>
          </div>
        )
      case 'grading':
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Grading</h2>
              <p className="text-sm">Grading feature coming soon...</p>
            </div>
          </div>
        )
      case 'students':
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Students</h2>
              <p className="text-sm">Students feature coming soon...</p>
            </div>
          </div>
        )
      case 'settings':
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Settings</h2>
              <p className="text-sm">Settings feature coming soon...</p>
            </div>
          </div>
        )
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
