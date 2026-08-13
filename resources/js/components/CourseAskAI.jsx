import { useState, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import {
  ArrowLeft, Send, Sparkles, BookOpen, FileText,
  Lightbulb, ClipboardList, User, Loader2, Download,
  Plus, X, Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import logoImage from '../../logo/MENTORA LOGO.png'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return String(Date.now())
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── DOCX export (same as ChatInterface) ──────────────────────────────────────
function extractQuestionBlocks(content) {
  const text = String(content || '').replace(/\r\n/g, '\n').trim()
  if (!text) return ''
  const normalized = text
    .replace(/```[\s\S]*?```/g, b => b.replace(/```/g, ''))
    .replace(/^#+\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
  const regex = /(?:^|\n)(?:Q\s*\d+[\):.-]?|\d+[\).:-])\s*[\s\S]*?(?=(?:\n(?:Q\s*\d+[\):.-]?|\d+[\).:-])\s*)|$)/gim
  const matches = (normalized.match(regex) || []).map(m => m.trim()).filter(m => m && /\?/m.test(m))
  if (matches.length > 0) return matches.join('\n\n')
  return normalized.split(/\n\s*\n+/).map(p => p.trim()).filter(p => p && /\?/m.test(p)).join('\n\n')
}

function countQuestions(content) {
  const ext = extractQuestionBlocks(content)
  if (!ext) return 0
  return ext.split(/\n\s*\n+/).filter(q => q.trim() && /\?/m.test(q)).length
}

function shouldShowDownload(message, index, messages) {
  if (!message || message.role !== 'assistant' || !message.content) return false
  if (countQuestions(message.content) < 3) return false
  const prior = [...messages].slice(0, index).reverse().find(m => m.role === 'user')
  const userPrompt = String(prior?.content || '')
  if (/\b(quiz|exam|test|assessment|question(?:s)?|worksheet|rubric|multiple\s*choice|true\s*or\s*false)\b/i.test(userPrompt)) return true
  return /(question\s*\d+|\b\d+[\).:-]\s+|answer\s*key|correct\s*answer|choices?\s*[A-D])/i.test(String(message.content))
}

async function downloadDocx(message) {
  const extracted = extractQuestionBlocks(message?.content)
  if (!extracted) { toast.error('No question set detected.'); return }
  const resp = await fetch('/api/chat/export-docx', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'X-CSRF-TOKEN': getToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify({ title: 'Generated Questions', content: extracted }),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const blob = await resp.blob()
  const match = (resp.headers.get('content-disposition') || '').match(/filename="?([^";]+)"?/i)
  const fileName = match?.[1] || 'generated_questions.docx'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = fileName
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────
export function CourseAskAI({ courseId, courseName, courseCode, currentTopic, onBack }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [materials, setMaterials] = useState([])
  const [attachedModule, setAttachedModule] = useState(null)
  const [showModulePicker, setShowModulePicker] = useState(false)

  const scrollRef = useRef(null)
  const pickerRef = useRef(null)

  // ── Fetch materials for the + picker ────────────────────────────────────────
  useEffect(() => {
    fetch('/api/materials', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : [])
      .then(d => setMaterials(Array.isArray(d) ? d.filter(m => !courseId || String(m.course_id) === String(courseId)) : []))
      .catch(() => {})
  }, [courseId])

  // ── Close picker on outside click ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowModulePicker(false)
    }
    if (showModulePicker) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showModulePicker])

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isLoading])

  // ── Markdown components (same as ChatInterface) ──────────────────────────────
  const markdownComponents = useMemo(() => ({
    h2: p => <h2 className="text-base font-semibold mt-3 mb-1 text-gray-900" {...p} />,
    h3: p => <h3 className="text-sm font-semibold mt-3 mb-1 text-gray-900" {...p} />,
    p:  p => <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900 my-1" {...p} />,
    strong: p => <strong className="font-semibold text-gray-900" {...p} />,
    ul: p => <ul className="list-disc pl-5 text-sm space-y-1 my-1 text-gray-900" {...p} />,
    ol: p => <ol className="list-decimal pl-5 text-sm space-y-1 my-1 text-gray-900" {...p} />,
    li: p => <li className="leading-relaxed" {...p} />,
    blockquote: p => <blockquote className="border-l-4 border-green-600 pl-3 italic text-sm opacity-90 my-2" {...p} />,
    code: p => <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-900 text-xs" {...p} />,
    pre:  p => <pre className="p-3 rounded bg-gray-100 overflow-x-auto text-xs my-2" {...p} />,
  }), [])

  const normalizeSources = (raw) => {
    if (!Array.isArray(raw)) return []
    return raw.map(s => {
      if (typeof s === 'string') return { title: s }
      if (s && typeof s === 'object') return s
      return null
    }).filter(Boolean)
  }

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = async (content) => {
    if (!content.trim() || isLoading) return

    const materialIdToSend = attachedModule?.id ?? null
    const userMsg = {
      id: generateId(), role: 'user',
      content: content.trim(), timestamp: formatTime(),
      attachedModule: attachedModule ? { ...attachedModule } : null,
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setAttachedModule(null)
    setIsLoading(true)

    try {
      const body = { message: content.trim(), course_id: courseId }
      if (conversationId) body.conversation_id = conversationId
      if (materialIdToSend) body.material_id = materialIdToSend

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })

      let data = {}
      try { data = await res.json() } catch { data = {} }

      if (!res.ok) throw new Error(data?.response || data?.message || `HTTP ${res.status}`)

      if (data.conversation_id && !conversationId) setConversationId(data.conversation_id)

      setMessages(prev => [...prev, {
        id: generateId(), role: 'assistant',
        content: data.response || 'Sorry, I could not generate a response.',
        timestamp: formatTime(),
        sources: Array.isArray(data.sources) ? data.sources : [],
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: generateId(), role: 'assistant',
        content: err?.message || 'Sorry, there was an error. Please try again.',
        timestamp: formatTime(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e) => { e.preventDefault(); sendMessage(input) }
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  // ── Quick prompts ────────────────────────────────────────────────────────────
  const quickPrompts = [
    { icon: BookOpen,    label: '📚 Lesson Plan',       prompt: `Create a detailed lesson plan for ${currentTopic || courseName}` },
    { icon: ClipboardList, label: '✍️ Generate Quiz',   prompt: `Generate 10 quiz questions about ${currentTopic || courseName}` },
    { icon: Lightbulb,  label: '💡 Explain Topic',      prompt: `Explain ${currentTopic || courseName} in simple terms for students` },
    { icon: FileText,   label: '🧩 Build a Rubric',     prompt: `Create a grading rubric for an assignment in ${courseName}` },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex h-full">

      {/* ── Main chat column ── */}
      <div className="flex-1 flex flex-col h-full bg-white min-w-0">

        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Badge variant="outline" className="text-xs">{courseCode}</Badge>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Assistant
              </Badge>
            </div>
            <h2 className="font-semibold text-sm truncate">{courseName}</h2>
            {currentTopic && <p className="text-xs text-gray-500 truncate">Topic: {currentTopic}</p>}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
          <div className="max-w-3xl mx-auto space-y-6">

            {/* Empty state + quick prompts */}
            {messages.length === 0 && !isLoading && (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <img src={logoImage} alt="Mentora" className="w-10 h-10 object-contain" />
                </div>
                <h3 className="text-lg font-medium mb-1">Ask AI — {courseName}</h3>
                <p className="text-gray-500 text-sm mb-6">
                  {currentTopic
                    ? `I have context on this course and the current topic: "${currentTopic}".`
                    : `I have context on all materials uploaded for ${courseName}.`}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  {quickPrompts.map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(qp.prompt)}
                      className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-green-300 transition-colors"
                    >
                      <p className="font-medium text-sm">{qp.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{qp.prompt}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((message, index) => (
              <div key={message.id} className="flex gap-3">
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'assistant' ? 'bg-green-100' : 'bg-gray-200'
                }`}>
                  {message.role === 'assistant'
                    ? <img src={logoImage} alt="Mentora" className="w-5 h-5 object-contain" />
                    : <User className="w-5 h-5 text-gray-600" />
                  }
                </div>

                {/* Bubble */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {message.role === 'assistant' ? 'Mentora' : 'You'}
                    </span>
                    <span className="text-xs text-gray-400">{message.timestamp}</span>
                    {message.role === 'user' && message.attachedModule && (
                      <Badge variant="outline" className="text-xs font-normal text-green-800 border-green-300 bg-green-50 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {message.attachedModule.label}
                      </Badge>
                    )}
                  </div>

                  <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-strong:text-gray-900 prose-strong:font-semibold prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-p:my-1">
                    {message.role === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    )}
                  </div>

                  {/* Source citations */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Sources:
                      </span>
                      {normalizeSources(message.sources).map((src, idx) => {
                        const key = src?.id ?? `${src?.title ?? 'src'}-${idx}`
                        const hasId = src?.id != null
                        return (
                          <Badge
                            key={key}
                            variant="outline"
                            className={hasId
                              ? 'text-xs font-normal text-green-800 border-green-300 bg-green-50 cursor-pointer hover:bg-green-100'
                              : 'text-xs font-normal text-green-800 border-green-300 bg-green-50'}
                            title={src?.course}
                            onClick={hasId ? () => window.open(`/api/materials/${src.id}/download`, '_blank') : undefined}
                          >
                            {src?.title ?? `Source ${idx + 1}`}
                          </Badge>
                        )
                      })}
                    </div>
                  )}

                  {/* DOCX download */}
                  {shouldShowDownload(message, index, messages) && !isLoading && (
                    <div className="mt-2">
                      <Button
                        type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
                        onClick={async () => {
                          try { await downloadDocx(message); toast.success('Questions downloaded as DOCX') }
                          catch { toast.error('DOCX download failed') }
                        }}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download Questions (.docx)
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <img src={logoImage} alt="Mentora" className="w-5 h-5 object-contain" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Mentora</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking…</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">

            {/* Attached material chip */}
            {attachedModule && (
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs font-normal text-green-800 border-green-300 bg-green-50 flex items-center gap-1 pr-1">
                  <FileText className="w-3 h-3" />
                  {attachedModule.label}
                  <button
                    type="button"
                    onClick={() => setAttachedModule(null)}
                    className="ml-1 rounded-full hover:bg-green-100 p-0.5"
                    aria-label="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              </div>
            )}

            <div className="flex gap-2 items-end">
              {/* + material picker */}
              <div className="relative" ref={pickerRef}>
                <Button
                  type="button" variant="outline" size="icon"
                  className="h-[60px] w-[44px] shrink-0 border-gray-300 hover:border-green-500 hover:text-green-700"
                  onClick={() => setShowModulePicker(v => !v)}
                  title="Attach a material"
                  disabled={isLoading}
                >
                  <Plus className="w-5 h-5" />
                </Button>

                {showModulePicker && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Attach Material</span>
                      <button type="button" onClick={() => setShowModulePicker(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="max-h-56 overflow-y-auto py-1">
                      {materials.length === 0 ? (
                        <p className="text-xs text-gray-400 px-3 py-3">No materials for this course yet</p>
                      ) : (
                        materials.map(m => {
                          const isSelected = attachedModule?.id === m.id
                          return (
                            <button
                              key={m.id} type="button"
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-green-50 text-green-800' : 'text-gray-800'}`}
                              onClick={() => { setAttachedModule(isSelected ? null : { id: m.id, label: m.title }); setShowModulePicker(false) }}
                            >
                              <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-green-600' : 'text-gray-400'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="truncate">{m.title}</p>
                                <p className="text-xs text-gray-400 truncate">{[m.course_name, m.type].filter(Boolean).join(' · ')}</p>
                              </div>
                              {isSelected && <span className="ml-auto text-green-600 text-xs shrink-0">✓</span>}
                            </button>
                          )
                        })
                      )}
                    </div>
                    <div className="px-3 py-2 border-t border-gray-100">
                      <p className="text-xs text-gray-400">AI will focus on this material for this message only.</p>
                    </div>
                  </div>
                )}
              </div>

              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask about ${courseName}…`}
                className="min-h-[60px] max-h-[200px]"
                disabled={isLoading}
              />

              <Button
                type="submit" size="icon"
                className="bg-green-700 hover:bg-green-800 h-[60px] w-[60px]"
                disabled={!input.trim() || isLoading}
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Press Enter to send · Shift+Enter for new line · AI has access to course materials
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
