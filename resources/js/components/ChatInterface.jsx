import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Send, Bot, User, Loader2, FileText, Download } from 'lucide-react'
import { toast } from 'sonner'
import ContextPanel from './ContextPanel'

let nextId = 1
function generateId() {
  return String(nextId++)
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function extractQuestionBlocks(content) {
  const text = String(content || '').replace(/\r\n/g, '\n').trim()
  if (!text) return ''

  const normalized = text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/^#+\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')

  const regex = /(?:^|\n)(?:Q\s*\d+[\):.-]?|\d+[\).:-])\s*[\s\S]*?(?=(?:\n(?:Q\s*\d+[\):.-]?|\d+[\).:-])\s*)|$)/gim
  const matches = normalized.match(regex) || []
  const cleaned = matches
    .map((m) => m.trim())
    .filter((m) => m && /\?/m.test(m))

  if (cleaned.length > 0) {
    return cleaned.join('\n\n')
  }

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => /\?/m.test(p))

  return paragraphs.join('\n\n')
}

async function downloadResponseDocx(message) {
  const extracted = extractQuestionBlocks(message?.content)
  if (!extracted) {
    toast.error('No question set detected in this response.')
    return
  }

  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
  const resp = await fetch('/api/chat/export-docx', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'X-CSRF-TOKEN': token,
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      title: 'Generated Questions',
      content: extracted,
    }),
  })

  if (!resp.ok) {
    throw new Error(`Failed to export DOCX (HTTP ${resp.status})`)
  }

  const blob = await resp.blob()
  const disposition = resp.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  const fileName = match?.[1] || 'generated_questions.docx'

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ChatInterface({ conversationId = null, onConversationCreated }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState(conversationId)
  const [activeCourseId, setActiveCourseId] = useState(null)
  const [courses, setCourses] = useState([])
  const scrollRef = useRef(null)

  function getToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
  }

  const activeCourse = courses.find(c => String(c.id) === String(activeCourseId))

  const getLastGradingPeriod = () => {
    try {
      return window.localStorage.getItem('mentora_last_grading_period') || ''
    } catch {
      return ''
    }
  }

  const withQuickActionContext = (baseMessage) => {
    if (!activeCourseId) return baseMessage

    const courseLabel = activeCourse
      ? `${activeCourse.course_code || ''}${activeCourse.course_code && activeCourse.course_name ? ' - ' : ''}${activeCourse.course_name || ''}`.trim()
      : ''

    const gradingPeriod = getLastGradingPeriod()

    const lines = []
    if (courseLabel) lines.push(`Course: ${courseLabel}`)
    if (gradingPeriod) lines.push(`Grading period: ${gradingPeriod}`)

    const mentionsMaterials = /materials|course\s+materials|uploaded/i.test(String(baseMessage || ''))
    if (!mentionsMaterials) {
      lines.push('Use my uploaded course materials as the primary reference.')
    }

    if (lines.length === 0) return baseMessage
    return `${lines.join('\n')}\n\n${baseMessage}`
  }

  const markdownComponents = {
    h2: (props) => <h2 className="text-base font-semibold mt-3 mb-1 text-gray-900" {...props} />,
    h3: (props) => <h3 className="text-sm font-semibold mt-3 mb-1 text-gray-900" {...props} />,
    p: (props) => <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900 my-1" {...props} />,
    strong: (props) => <strong className="font-semibold text-gray-900" {...props} />,
    ul: (props) => <ul className="list-disc pl-5 text-sm space-y-1 my-1 text-gray-900" {...props} />,
    ol: (props) => <ol className="list-decimal pl-5 text-sm space-y-1 my-1 text-gray-900" {...props} />,
    li: (props) => <li className="leading-relaxed" {...props} />,
    blockquote: (props) => (
      <blockquote className="border-l-4 border-green-600 pl-3 italic text-sm opacity-90 my-2" {...props} />
    ),
    code: (props) => <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-900 text-xs" {...props} />,
    pre: (props) => <pre className="p-3 rounded bg-gray-100 overflow-x-auto text-xs my-2" {...props} />,
  }

  const normalizeSources = (rawSources) => {
    if (!Array.isArray(rawSources)) return []
    return rawSources
      .map((s) => {
        if (typeof s === 'string') return { title: s }
        if (s && typeof s === 'object') return s
        return null
      })
      .filter(Boolean)
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  useEffect(() => {
    fetch('/api/courses', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]))
  }, [])

  // Reset messages when conversationId prop changes
  useEffect(() => {
    setCurrentConversationId(conversationId)
  }, [conversationId])

  // Load chat history when conversationId changes
  useEffect(() => {
    if (!currentConversationId) {
      setMessages([])
      return
    }

    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
    fetch(`/api/chat/history/${currentConversationId}`, {
      headers: {
        'Accept': 'application/json',
        'X-CSRF-TOKEN': token || '',
      },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : [])
      .then(history => {
        if (Array.isArray(history) && history.length > 0) {
          const loaded = []
          history.forEach(chat => {
            loaded.push({
              id: generateId(),
              role: 'user',
              content: chat.message,
              timestamp: new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            })
            loaded.push({
              id: generateId(),
              role: 'assistant',
              content: chat.response,
              timestamp: new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            })
          })
          setMessages(loaded)
        } else {
          setMessages([])
        }
      })
      .catch(() => { setMessages([]) })
  }, [currentConversationId])

  const sendMessage = async (content) => {
    if (!content.trim() || isLoading) return

    const userMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: formatTime(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
      const body = { message: content.trim() }
      if (currentConversationId) {
        body.conversation_id = currentConversationId
      }
      if (activeCourseId) {
        body.course_id = activeCourseId
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': token || '',
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      // If this was a new conversation, save the returned conversation_id
      if (data.conversation_id && !currentConversationId) {
        setCurrentConversationId(data.conversation_id)
        onConversationCreated?.(data.conversation_id)
      }

      const assistantMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.response || 'Sorry, I could not generate a response.',
        timestamp: formatTime(),
        sources: Array.isArray(data.sources) ? data.sources : [],
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, there was an error connecting to the AI provider. Please try again in a moment.',
        timestamp: formatTime(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex-1 flex h-full">
      {/* Chat Column */}
      <div className="flex-1 flex flex-col h-full bg-white min-w-0">
      <div className="border-b border-gray-200 p-4">
        <h2 className="font-semibold">AI Teaching Assistant</h2>
        <p className="text-sm text-gray-500">Ask questions about your course materials</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && !isLoading ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-green-700" />
              </div>
              <h3 className="text-lg font-medium mb-2">Welcome to Mentora!</h3>
              <p className="text-gray-500 mb-4">I&apos;m your context-aware teaching assistant.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                <button
                  onClick={() => sendMessage(withQuickActionContext("Create a lesson plan for OSPF multi-area"))}
                  className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="font-medium text-sm">📚 Lesson Planning</p>
                  <p className="text-xs text-gray-500">Create comprehensive lesson plans</p>
                </button>
                <button
                  onClick={() => sendMessage(withQuickActionContext("Generate quiz questions about Database normalization"))}
                  className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="font-medium text-sm">✍️ Generate Quiz</p>
                  <p className="text-xs text-gray-500">Create assessments with rubrics</p>
                </button>
                <button
                  onClick={() => sendMessage(withQuickActionContext("Help me grade student submissions"))}
                  className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="font-medium text-sm">📊 Grading Assistance</p>
                  <p className="text-xs text-gray-500">AI-powered grading suggestions</p>
                </button>
                <button
                  onClick={() => sendMessage(withQuickActionContext("Create an assignment for OSPF configuration"))}
                  className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="font-medium text-sm">📝 Create Assignment</p>
                  <p className="text-xs text-gray-500">Design student projects</p>
                </button>
                <button
                  onClick={() => sendMessage(withQuickActionContext("Summarize the key concepts from my uploaded course materials"))}
                  className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="font-medium text-sm">📄 Summarize Materials</p>
                  <p className="text-xs text-gray-500">Extract key points and examples</p>
                </button>
                <button
                  onClick={() => sendMessage(withQuickActionContext("Create a grading rubric for my next assignment with criteria and point breakdown"))}
                  className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="font-medium text-sm">🧩 Build a Rubric</p>
                  <p className="text-xs text-gray-500">Clear criteria and point weighting</p>
                </button>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'assistant' ? 'bg-green-100' : 'bg-gray-200'
                }`}>
                  {message.role === 'assistant' ? (
                    <Bot className="w-5 h-5 text-green-700" />
                  ) : (
                    <User className="w-5 h-5 text-gray-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {message.role === 'assistant' ? 'Mentora' : 'You'}
                    </span>
                    <span className="text-xs text-gray-500">{message.timestamp}</span>
                  </div>
                  <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-strong:text-gray-900 prose-strong:font-semibold prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-p:my-1">
                    {message.role === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  {/* RAG Source Citations */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Sources:
                      </span>
                      {normalizeSources(message.sources).map((src, idx) => {
                        const key = src?.id ?? `${src?.title ?? 'source'}-${idx}`
                        const hasId = typeof src?.id !== 'undefined' && src?.id !== null
                        return (
                          <Badge
                            key={key}
                            variant="outline"
                            className={
                              hasId
                                ? 'text-xs font-normal text-green-800 border-green-300 bg-green-50 cursor-pointer hover:bg-green-100'
                                : 'text-xs font-normal text-green-800 border-green-300 bg-green-50'
                            }
                            title={src?.course}
                            onClick={
                              hasId
                                ? () => window.open(`/api/materials/${src.id}/download`, '_blank')
                                : undefined
                            }
                          >
                            {src?.title ?? `Source ${idx + 1}`}
                          </Badge>
                        )
                      })}
                    </div>
                  )}
                  {message.role === 'assistant' && !isLoading && message.content && (
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={async () => {
                          try {
                            await downloadResponseDocx(message)
                            toast.success('Questions downloaded as DOCX')
                          } catch {
                            toast.error('DOCX download failed')
                          }
                        }}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download Questions (.docx)
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-green-100">
                <Bot className="w-5 h-5 text-green-700" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">Mentora</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Analyzing context and generating response...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your course materials..."
              className="min-h-[60px] max-h-[200px]"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="bg-green-700 hover:bg-green-800 h-[60px] w-[60px]"
              disabled={!input.trim() || isLoading}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift + Enter for new line
          </p>
        </form>
      </div>
      </div>

      {/* Context Panel (right sidebar) */}
      <ContextPanel
        onQuickAction={(msg) => sendMessage(withQuickActionContext(msg))}
        onCourseChange={(courseId) => setActiveCourseId(courseId)}
      />
    </div>
  )
}
