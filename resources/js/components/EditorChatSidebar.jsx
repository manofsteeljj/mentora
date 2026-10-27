import { useState, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Send, Loader2, User, X, Copy, Check, FileText, Plus, FileInput } from 'lucide-react'
import logoImage from '../../logo/MENTORA LOGO.png'

function csrf() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return String(Date.now()) + String(Math.random()).slice(2, 8)
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Sidebar resize bounds (px) ────────────────────────────────────────────────
const MIN_WIDTH     = 300
const MAX_WIDTH     = 640
const DEFAULT_WIDTH = 384
const WIDTH_KEY     = 'mentora-editor-chat-width'

/**
 * Compact context block describing the lesson plan the teacher is editing,
 * prepended to each message so the AI answers with the right document in mind.
 */
function buildContextBlock(plan, fallbackTitle) {
  if (!plan) return ''
  const bits = [
    `Title: ${plan.title || fallbackTitle || 'Lesson Plan'}`,
    plan.grade_level ? `Grade Level: ${plan.grade_level}` : null,
    plan.subject ? `Subject: ${plan.subject}` : null,
    plan.topic ? `Topic: ${plan.topic}` : null,
    plan.duration ? `Duration: ${plan.duration}` : null,
    plan.learning_competency ? `Learning Competency: ${plan.learning_competency}` : null,
    plan.teaching_strategy ? `Teaching Strategy: ${plan.teaching_strategy}` : null,
  ].filter(Boolean)

  return `[Context: The teacher is editing a DepEd Daily Lesson Log (DLL) in the document editor with these details:\n${bits.join('\n')}]\n\n`
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

/**
 * EditorChatSidebar
 *
 * AI assistant sidebar shown next to the ONLYOFFICE editor, so teachers can
 * ask for suggestions while editing and copy the results into their document.
 *
 * Props:
 *   plan    — lesson plan object (title, grade_level, subject, topic, …)
 *   title   — display title fallback when no plan object is available
 *   onClose — callback when the user closes the sidebar
 *   onInsertIntoDocument — callback (text) => Promise<boolean> that inserts the
 *                          given AI response into the open ONLYOFFICE document.
 *                          Null when the editor cannot accept insertions
 *                          (e.g. read-only review mode).
 *   canInsertIntoDocument — whether the insert bridge is ready (editor loaded)
 */
export default function EditorChatSidebar({
  plan = null,
  title = 'Document',
  onClose,
  onInsertIntoDocument = null,
  canInsertIntoDocument = false,
}) {
  const [messages, setMessages]         = useState([])
  const [input, setInput]               = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [copiedId, setCopiedId]         = useState(null)
  const [insertedId, setInsertedId]     = useState(null)
  const [materials, setMaterials]       = useState([])
  const [attachedMaterial, setAttachedMaterial] = useState(null)
  const [showMaterialPicker, setShowMaterialPicker] = useState(false)
  const [width, setWidth] = useState(() => {
    // Restore the teacher's preferred width, clamped to the current viewport
    const maxByViewport = Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.6))
    try {
      const saved = Number(localStorage.getItem(WIDTH_KEY))
      if (Number.isFinite(saved) && saved >= MIN_WIDTH) {
        return Math.min(saved, MAX_WIDTH, maxByViewport)
      }
    } catch {}
    return DEFAULT_WIDTH
  })
  const [isResizing, setIsResizing] = useState(false)
  const scrollRef    = useRef(null)
  const pickerRef    = useRef(null)

  const contextBlock = useMemo(() => buildContextBlock(plan, title), [plan, title])

  // ── Drag-to-resize (left edge handle) ────────────────────────────────────────
  const startResize = (e) => {
    e.preventDefault()
    setIsResizing(true)

    const startX = e.clientX
    const startW = width
    let latest   = startW

    const onMove = (ev) => {
      const maxW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth * 0.6))
      latest = Math.min(Math.max(startW + (startX - ev.clientX), MIN_WIDTH), maxW)
      setWidth(latest)
    }

    const onUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor    = ''
      document.body.style.userSelect = ''
      try { localStorage.setItem(WIDTH_KEY, String(Math.round(latest))) } catch {}
    }

    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── Fetch materials for the + picker ─────────────────────────────────────────
  useEffect(() => {
    fetch('/api/materials', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : [])
      .then(d => setMaterials(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  // ── Close picker on outside click ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowMaterialPicker(false)
    }
    if (showMaterialPicker) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMaterialPicker])

  // ── Auto-scroll to the latest message ───────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isLoading])

  // ── Markdown components (same styling as the other chat views) ─────────────
  const markdownComponents = useMemo(() => ({
    h1: p => <h1 className="text-base font-bold mt-3 mb-1.5 text-gray-900" {...p} />,
    h2: p => <h2 className="text-sm font-semibold mt-2 mb-1 text-gray-900" {...p} />,
    h3: p => <h3 className="text-sm font-semibold mt-2 mb-1 text-gray-900" {...p} />,
    p:  p => <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900 my-1" {...p} />,
    strong: p => <strong className="font-semibold text-gray-900" {...p} />,
    ul: p => <ul className="list-disc pl-5 text-sm space-y-1 my-1 text-gray-900" {...p} />,
    ol: p => <ol className="list-decimal pl-5 text-sm space-y-1 my-1 text-gray-900" {...p} />,
    li: p => <li className="leading-relaxed" {...p} />,
    blockquote: p => <blockquote className="border-l-4 border-green-600 pl-3 italic text-sm opacity-90 my-2" {...p} />,
    a:  p => <a className="text-green-700 underline underline-offset-2 break-all" target="_blank" rel="noreferrer" {...p} />,
    hr: () => <hr className="my-3 border-gray-200" />,
    code: p => <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-900 text-xs" {...p} />,
    pre:  p => <pre className="p-3 rounded bg-gray-100 overflow-x-auto text-xs my-2" {...p} />,
    table: p => (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full text-xs border-collapse" {...p} />
      </div>
    ),
    th: p => <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-left font-semibold text-gray-900" {...p} />,
    td: p => <td className="border border-gray-300 px-2 py-1 align-top text-gray-900" {...p} />,
  }), [])

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = async (rawText) => {
    const userText = String(rawText || '').trim()
    if (!userText || isLoading) return

    const materialIdToSend = attachedMaterial?.id ?? null

    setMessages(prev => [...prev, {
      id: generateId(), role: 'user',
      content: userText, timestamp: formatTime(),
      attachedMaterial: attachedMaterial ? { ...attachedMaterial } : null,
    }])
    setInput('')
    setAttachedMaterial(null)
    setShowMaterialPicker(false)
    setIsLoading(true)

    try {
      const body = { message: (contextBlock + userText).slice(0, 5000) }
      if (conversationId) body.conversation_id = conversationId
      if (plan?.course_id) body.course_id = plan.course_id
      if (materialIdToSend) body.material_id = materialIdToSend

      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf() },
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
        isError: true,
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e) => { e.preventDefault(); sendMessage(input) }
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const handleCopy = async (message) => {
    const ok = await copyToClipboard(message.content)
    if (ok) {
      setCopiedId(message.id)
      toast.success('Copied — paste it into your document.')
      setTimeout(() => setCopiedId(null), 2000)
    } else {
      toast.error('Could not copy to clipboard.')
    }
  }

  // Extracts only the necessary content from the AI response, removing
  // markdown formatting, code fences, meta-commentary, and explanatory text,
  // then inserts the clean content into the ONLYOFFICE document at the cursor.
  const handleInsert = async (message) => {
    if (typeof onInsertIntoDocument !== 'function') {
      toast.error('Inserting is only available while editing a document.')
      return
    }
    
    // Extract only necessary content
    const cleanContent = extractNecessaryContent(message.content)
    
    if (!cleanContent.trim()) {
      toast.error('No content to insert after cleanup.')
      return
    }
    
    const ok = await onInsertIntoDocument(cleanContent)
    if (ok) {
      setInsertedId(message.id)
      toast.success('Inserted into your document.')
      setTimeout(() => setInsertedId(null), 2000)
    }
  }
  
  /**
   * Extracts only the necessary content from an AI response.
   * Removes markdown formatting, code fences, meta-commentary, etc.
   */
  const extractNecessaryContent = (rawContent) => {
    let content = String(rawContent || '').trim()
    
    // Remove markdown code fences (```json, ```text, etc.)
    content = content.replace(/```(?:json|javascript|text|markdown|html|xml|css|python|php)?\s*/gi, '')
    content = content.replace(/```/g, '')
    
    // Remove common meta-commentary patterns at the start
    const metaPrefixes = [
      /^(?:here|this|below)\s+(?:is|are|'s)\s+(?:a|an|the|your|some)?\s*(?:suggested|revised|improved|complete|final)?\s*(?:version|draft|text|content|output|response|answer)?:?\s*/i,
      /^(?:certainly|sure|of course|absolutely|definitely)!?\s*(?:here|i'?ve|let me|i can)?\s*(?:provide|give|present|share|show|offer|created?|generated?)?\s*(?:you|some)?\s*(?:with)?\s*(?:a|an|the|your|some)?\s*(?:suggested|revised|improved|complete|final)?\s*(?:version|draft|text|content|output|response|answer)?:?\s*/i,
      /^i'?(?:ve|ll|d)?\s+(?:created?|generated?|prepared?|written|made|provided|revised|improved|updated)\s+(?:a|an|the|your|some)?\s*(?:suggested|revised|improved|complete|final)?\s*(?:version|draft|text|content|output|response)?:?\s*/i,
      /^(?:based on|considering|taking into account|as requested)\s+(?:your|the)\s+(?:request|input|requirements?)[:,]?\s*/i,
    ]
    
    for (const pattern of metaPrefixes) {
      content = content.replace(pattern, '')
    }
    
    // Remove common closing commentary
    const metaSuffixes = [
      /\n\s*(?:feel free to|please|you can)\s+(?:let me know|tell me|ask|modify|adjust|edit|change|customize)\s+.{0,100}$/i,
      /\n\s*(?:i hope|this should|this will)\s+(?:helps?|works?|meets?)\s+.{0,80}$/i,
      /\n\s*(?:note|remember|important):\s*.{0,100}$/i,
    ]
    
    for (const pattern of metaSuffixes) {
      content = content.replace(pattern, '')
    }
    
    // If the content looks like it's wrapped in a single JSON structure or list, extract it
    content = content.trim()
    
    // If it starts with explanatory text followed by a list/content, try to extract just the list
    const listMatch = content.match(/(?:^|\n)(?:[-*•]|\d+\.)\s+.+/s)
    if (listMatch && listMatch.index > 0 && listMatch.index < 200) {
      // There's explanatory text before a list — check if we should extract just the list
      const beforeList = content.substring(0, listMatch.index).trim()
      const afterList = content.substring(listMatch.index).trim()
      
      // If the text before the list is short meta-commentary, prefer just the list
      if (beforeList.length < 150 && /^(?:here|this|below|i'?ve|suggested|revised)/i.test(beforeList)) {
        content = afterList
      }
    }
    
    // Remove markdown bold/italic (but keep the text)
    content = content.replace(/\*\*\*(.+?)\*\*\*/g, '$1')  // bold+italic
    content = content.replace(/\*\*(.+?)\*\*/g, '$1')      // bold
    content = content.replace(/\*(.+?)\*/g, '$1')          // italic
    content = content.replace(/__(.+?)__/g, '$1')          // bold alt
    content = content.replace(/_(.+?)_/g, '$1')            // italic alt
    
    // Remove markdown headers but keep the text
    content = content.replace(/^#{1,6}\s+/gm, '')
    
    // Clean up excessive line breaks (more than 2 consecutive)
    content = content.replace(/\n{3,}/g, '\n\n')
    
    // Remove horizontal rules
    content = content.replace(/^(?:---+|===+|\*\*\*+|___+)\s*$/gm, '')
    
    // Clean up blockquote markers
    content = content.replace(/^>\s+/gm, '')
    
    // Trim final result
    content = content.trim()
    
    // If the content is a JSON-like structure that was accidentally included, try to extract readable parts
    if (content.startsWith('{') && content.endsWith('}')) {
      try {
        const parsed = JSON.parse(content)
        // If it's a simple object with text values, extract and format them
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          const parts = []
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === 'string' && value.trim()) {
              parts.push(value.trim())
            } else if (Array.isArray(value)) {
              parts.push(...value.filter(v => typeof v === 'string' && v.trim()))
            }
          }
          if (parts.length > 0) {
            content = parts.join('\n\n')
          }
        }
      } catch {
        // Not valid JSON, keep as-is
      }
    }
    
    return content
  }

  // ── Quick prompts for lesson plan editing ────────────────────────────────────
  const quickPrompts = [
    { label: '🎯 Improve my objectives', prompt: 'Review the learning objectives of this lesson plan and suggest improved, measurable versions.' },
    { label: '💡 Suggest activities',    prompt: 'Suggest 3 engaging classroom activities for this lesson, each with a short description and time estimate.' },
    { label: '✍️ Create assessment',     prompt: 'Create a 10-item assessment quiz for this lesson with an answer key.' },
    { label: '🧩 Differentiate',         prompt: 'How can I differentiate this lesson for struggling learners and advanced learners?' },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <aside
      className="hidden md:flex flex-col flex-shrink-0 bg-white border-l border-gray-200 min-h-0 relative"
      style={{ width }}
    >

      {/* ── Resize handle (drag to resize · double-click to reset) ────────── */}
      <div
        onMouseDown={startResize}
        onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
        className="absolute left-0 inset-y-0 w-1.5 cursor-col-resize z-20 bg-transparent hover:bg-green-600/25 active:bg-green-600/40 transition-colors"
        title="Drag to resize · double-click to reset"
      />

      {/* Full-screen shield while dragging — stops the ONLYOFFICE iframe
          from swallowing mousemove events mid-drag */}
      {isResizing && (
        <div className="fixed inset-0 z-[9999] cursor-col-resize" />
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <img src={logoImage} alt="Mentora" className="w-5 h-5 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900">Mentora AI</h3>
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px] px-1.5">
              Assistant
            </Badge>
          </div>
          <p className="text-xs text-gray-500 truncate">
            {plan ? [plan.grade_level, plan.subject].filter(Boolean).join(' · ') || plan.title : title}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onClose} title="Close AI sidebar">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4" ref={scrollRef}>
        <div className="space-y-4">

          {/* Empty state + quick prompts */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <img src={logoImage} alt="Mentora" className="w-8 h-8 object-contain" />
              </div>
              <h3 className="font-medium text-sm text-gray-900">Ask AI about this lesson plan</h3>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Get suggestions while you edit — then copy them straight into your document.
              </p>
              <div className="grid gap-2 text-left">
                {quickPrompts.map((qp, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(qp.prompt)}
                    className="p-2.5 border border-gray-200 rounded-lg bg-white hover:border-green-300 hover:bg-green-50/60 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800">{qp.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{qp.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map(message => (
            <div key={message.id} className="flex gap-2.5">
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
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-sm text-gray-900">
                    {message.role === 'assistant' ? 'Mentora' : 'You'}
                  </span>
                  <span className="text-xs text-gray-400">{message.timestamp}</span>
                  {message.role === 'user' && message.attachedMaterial && (
                    <Badge variant="outline" className="text-[10px] font-normal text-green-800 border-green-300 bg-green-50 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {message.attachedMaterial.title}
                    </Badge>
                  )}
                </div>

                {message.role === 'assistant' ? (
                  <div className={message.isError ? 'text-sm text-red-600' : ''}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-gray-900">{message.content}</p>
                )}

                {/* Actions for assistant replies */}
                {message.role === 'assistant' && !isLoading && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(message)}
                      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-700 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedId === message.id
                        ? <><Check className="w-3.5 h-3.5" />Copied</>
                        : <><Copy className="w-3.5 h-3.5" />Copy</>
                      }
                    </button>

                    {onInsertIntoDocument && (
                      <button
                        type="button"
                        onClick={() => handleInsert(message)}
                        disabled={!canInsertIntoDocument}
                        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-green-700 transition-colors disabled:text-gray-300 disabled:hover:text-gray-300 disabled:cursor-not-allowed"
                        title={canInsertIntoDocument
                          ? 'Insert into the open document at the cursor'
                          : 'The document editor is still loading…'}
                      >
                        {insertedId === message.id
                          ? <><Check className="w-3.5 h-3.5" />Inserted</>
                          : <><FileInput className="w-3.5 h-3.5" />Insert into document</>
                        }
                      </button>
                    )}
                  </div>
                )}

                {/* Source citations */}
                {message.role === 'assistant' && message.sources?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <FileText className="w-3 h-3" />Sources:
                    </span>
                    {message.sources.map((src, i) => (
                      <Badge
                        key={src.id ?? `${src.title ?? 'src'}-${i}`}
                        variant="outline"
                        className="text-[10px] font-normal text-green-800 border-green-300 bg-green-50"
                        title={src.course}
                      >
                        {src.title || `Source ${i + 1}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <img src={logoImage} alt="Mentora" className="w-5 h-5 object-contain" />
              </div>
              <div className="flex items-center gap-2 text-gray-500 pt-1">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-gray-200 p-3 bg-white">
        <form onSubmit={handleSubmit}>

          {/* Attached material chip */}
          {attachedMaterial && (
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs font-normal text-green-800 border-green-300 bg-green-50 flex items-center gap-1 pr-1 max-w-full">
                <FileText className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{attachedMaterial.title}</span>
                <button
                  type="button"
                  onClick={() => setAttachedMaterial(null)}
                  className="ml-1 rounded-full hover:bg-green-100 p-0.5 flex-shrink-0"
                  aria-label="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* + material picker */}
            <div className="relative flex-shrink-0" ref={pickerRef}>
              <Button
                type="button" variant="outline" size="icon"
                className="h-[52px] w-[44px] border-gray-300 hover:border-green-500 hover:text-green-700"
                onClick={() => setShowMaterialPicker(v => !v)}
                title="Attach a course material"
                disabled={isLoading}
              >
                <Plus className="w-5 h-5" />
              </Button>

              {showMaterialPicker && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Attach Material</span>
                    <button type="button" onClick={() => setShowMaterialPicker(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {materials.length === 0 ? (
                      <p className="text-xs text-gray-400 px-3 py-3">
                        No materials uploaded yet — upload some under Course Materials.
                      </p>
                    ) : (
                      materials.map(m => {
                        const isSelected = attachedMaterial?.id === m.id
                        return (
                          <button
                            key={m.id} type="button"
                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-green-50 text-green-800' : 'text-gray-800'}`}
                            onClick={() => {
                              setAttachedMaterial(isSelected ? null : { id: m.id, title: m.title })
                              setShowMaterialPicker(false)
                            }}
                          >
                            <FileText className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-green-600' : 'text-gray-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{m.title}</p>
                              <p className="text-xs text-gray-400 truncate">{[m.course_name, m.type].filter(Boolean).join(' · ')}</p>
                            </div>
                            {isSelected && <span className="ml-auto text-green-600 text-xs flex-shrink-0">✓</span>}
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
              placeholder="Ask about this lesson plan…"
              className="min-h-[52px] max-h-[160px] text-sm"
              disabled={isLoading}
            />
            <Button
              type="submit" size="icon"
              className="bg-green-700 hover:bg-green-800 h-[52px] w-[52px] flex-shrink-0"
              disabled={!input.trim() || isLoading}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-[11px] text-gray-400 mt-1.5">
            Enter to send · Shift+Enter for a new line
          </p>
        </form>
      </div>
    </aside>
  )
}
