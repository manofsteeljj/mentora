import { useEffect, useRef, useState } from 'react'
import { DocumentEditor } from '@onlyoffice/document-editor-react'
import { toast } from 'sonner'
import { Loader2, AlertTriangle, ArrowLeft, FileText, Sparkles, MessageSquare } from 'lucide-react'
import { Button } from './ui/button'
import EditorChatSidebar from './EditorChatSidebar'
import CommentsSidebar from './CommentsSidebar'

function csrf() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

// How long to wait for the insert-bridge plugin to acknowledge an insertion
const INSERT_ACK_TIMEOUT_MS = 8000

function insertErrorMessage(error) {
  if (error === 'editor-not-ready') return 'The document editor is still loading — try again in a few seconds.'
  if (error === 'empty') return 'There is nothing to insert — the response is empty.'
  return 'Could not insert into the document. Please try again.'
}

/**
 * OnlyOfficeEditor
 *
 * Fetches the editor config from Laravel, then renders the ONLYOFFICE
 * DocumentEditor component inside the Mentora UI.
 *
 * Props:
 *   documentType        — 'lesson-plan' | 'class-record'
 *   documentId          — numeric ID
 *   title               — display title (optional, shown in header)
 *   plan                — full lesson plan object (optional; gives the AI sidebar context)
 *   onBack              — callback when user clicks Back
 *   onSaved             — callback when ONLYOFFICE reports a successful save
 *   editorMode          — 'edit' (default) | 'view' — read-only rendering (admin review)
 *   showChatSidebar     — show the "Ask AI" sidebar tab (default true)
 *   showCommentsSidebar — show the review "Comments" sidebar tab (lesson plans only)
 *   toolbarExtra        — extra node rendered at the right of the toolbar (e.g. review actions)
 *
 * Owns the "Insert into document" bridge: the AI sidebar calls
 * onInsertIntoDocument(text), which is relayed to the hidden ONLYOFFICE
 * insert-bridge plugin and inserted at the document's cursor position.
 */
export default function OnlyOfficeEditor({
  documentType = 'lesson-plan',
  documentId,
  title = 'Document',
  plan = null,
  onBack,
  onSaved,
  editorMode = 'edit',
  showChatSidebar = true,
  showCommentsSidebar = false,
  toolbarExtra = null,
}) {
  const [state, setState] = useState('loading')   // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('')
  const [editorConfig, setEditorConfig] = useState(null)
  const [ooUrl, setOoUrl] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1280
  )
  const [sidebarTab, setSidebarTab] = useState(showCommentsSidebar ? 'comments' : 'chat')
  const [commentCount, setCommentCount] = useState(null)
  const editorRef = useRef(null)

  // ── "Insert into document" bridge ─────────────────────────────────────────
  // Laravel autostarts a tiny hidden ONLYOFFICE plugin (served by the app
  // itself) that relays text into the open document. The plugin iframe
  // announces itself here once loaded; insertions are then posted to it.
  const insertPluginWindowRef = useRef(null)
  const insertPendingRef = useRef(null)          // { reqId, timer, resolve }
  const [insertBridgeReady, setInsertBridgeReady] = useState(false)

  useEffect(() => {
    const onWindowMessage = (e) => {
      // The bridge plugin is served by this app — same origin as the page
      if (e.origin !== window.location.origin) return
      const data = e.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'mentora:plugin-ready') {
        insertPluginWindowRef.current = e.source
        setInsertBridgeReady(true)
        return
      }

      if (data.type === 'mentora:insert-result') {
        const pending = insertPendingRef.current
        if (!pending || pending.reqId !== data.reqId) return
        insertPendingRef.current = null
        clearTimeout(pending.timer)
        if (data.ok) {
          pending.resolve(true)
        } else {
          toast.error(insertErrorMessage(data.error))
          pending.resolve(false)
        }
      }
    }

    window.addEventListener('message', onWindowMessage)
    return () => window.removeEventListener('message', onWindowMessage)
  }, [])

  // The editor (and with it the bridge plugin) is recreated whenever the
  // document changes — wait for a fresh "plugin ready" handshake.
  useEffect(() => {
    setInsertBridgeReady(false)
    insertPluginWindowRef.current = null
  }, [documentType, documentId, editorMode])

  // The AI sidebar is only wired up for lesson plans (docx) for now
  const showChat = showChatSidebar && documentType === 'lesson-plan'
  // Comments are a lesson-plan review feature
  const showComments = showCommentsSidebar && documentType === 'lesson-plan'

  // ── Fetch editor config from Laravel ──────────────────────────────────────
  useEffect(() => {
    if (!documentId) return

    setState('loading')
    setErrorMsg('')

    const modeQuery = editorMode === 'view' ? '?mode=view' : ''
    fetch(`/api/documents/${documentType}/${documentId}/editor${modeQuery}`, {
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
      credentials: 'same-origin',
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.message || `HTTP ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        setEditorConfig(data.config)
        setOoUrl(data.onlyofficeUrl || import.meta.env.VITE_ONLYOFFICE_URL || 'http://localhost:8080')
        setState('ready')
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Could not load document.')
        setState('error')
      })
  }, [documentType, documentId, editorMode])

  // ── ONLYOFFICE event handlers ─────────────────────────────────────────────
  const onDocumentReady = () => {
    // editor is fully loaded
  }

  const onError = (event) => {
    console.error('ONLYOFFICE editor error:', event)
    console.error('ONLYOFFICE editor error details:', JSON.stringify(event, null, 2))

    setErrorMsg(
      event?.data?.errorDescription ||
      event?.data?.error ||
      event?.errorDescription ||
      "ONLYOFFICE reported an error. Please check the ONLYOFFICE server logs for details."
    )
    setState('error')
  }

  const onRequestSaveAs = () => {
    onSaved?.()
  }

  // Passes the AI response to the bridge plugin, which inserts it at the
  // document's current cursor position. Resolves true on success.
  const handleInsertIntoDocument = (text) => {
    const value = String(text ?? '').trim()
    if (!value) {
      toast.error('There is nothing to insert — the response is empty.')
      return Promise.resolve(false)
    }

    const pluginWindow = insertPluginWindowRef.current
    if (!pluginWindow || !insertBridgeReady) {
      toast.error('The document editor is still loading — try again in a few seconds.')
      return Promise.resolve(false)
    }

    return new Promise((resolve) => {
      const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      const timer = setTimeout(() => {
        if (insertPendingRef.current?.reqId !== reqId) return
        insertPendingRef.current = null
        toast.error('Could not reach the document editor — please try again.')
        resolve(false)
      }, INSERT_ACK_TIMEOUT_MS)

      insertPendingRef.current = { reqId, timer, resolve }

      try {
        pluginWindow.postMessage(
          { type: 'mentora:insert', reqId, text: value },
          window.location.origin
        )
      } catch (err) {
        clearTimeout(timer)
        insertPendingRef.current = null
        toast.error('Could not insert into the document. Please try again.')
        resolve(false)
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 z-10">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />Back
          </Button>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="w-4 h-4 text-green-700 flex-shrink-0" />
          <span className="font-semibold text-gray-800 truncate">{title}</span>
          {state === 'ready' && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded ml-1 whitespace-nowrap">
              {editorMode === 'view' ? 'Viewing in ONLYOFFICE (read-only)' : 'Editing in ONLYOFFICE'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {showComments && (
            <Button
              variant={sidebarOpen && sidebarTab === 'comments' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (sidebarOpen && sidebarTab === 'comments') {
                  setSidebarOpen(false)
                } else {
                  setSidebarTab('comments')
                  setSidebarOpen(true)
                }
              }}
              title="Toggle comments sidebar"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              Comments
              {commentCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {commentCount}
                </span>
              )}
            </Button>
          )}
          {showChat && (
            <Button
              variant={sidebarOpen && sidebarTab === 'chat' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (sidebarOpen && sidebarTab === 'chat') {
                  setSidebarOpen(false)
                } else {
                  setSidebarTab('chat')
                  setSidebarOpen(true)
                }
              }}
              title="Toggle AI assistant sidebar"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Ask AI
            </Button>
          )}
          {toolbarExtra}
          {editorMode === 'view' ? (
            <div className="text-xs text-gray-400 hidden sm:block">
              Read-only review copy
            </div>
          ) : (
            <div className="text-xs text-gray-400 hidden sm:block">
              Changes save automatically via ONLYOFFICE
            </div>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Editor column */}
        <div className="flex-1 relative min-w-0">

        {state === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50">
            <Loader2 className="w-8 h-8 animate-spin text-green-700" />
            <p className="text-gray-500 text-sm">Loading document editor…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-50 p-8">
            <AlertTriangle className="w-10 h-10 text-red-400" />
            <div className="text-center max-w-sm">
              <p className="font-semibold text-gray-800 mb-1">Could not open the editor</p>
              <p className="text-sm text-gray-500">{errorMsg}</p>
              <p className="text-xs text-gray-400 mt-2">
                Make sure the ONLYOFFICE server is running at{' '}
                <code className="bg-gray-100 px-1 rounded">
                  {import.meta.env.VITE_ONLYOFFICE_URL || 'http://localhost:8080'}
                </code>
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setState('loading') || location.reload()}>
                Retry
              </Button>
              {onBack && (
                <Button variant="ghost" size="sm" onClick={onBack}>
                  Go back
                </Button>
              )}
            </div>
          </div>
        )}

        {state === 'ready' && editorConfig && (
          <div className="absolute inset-0">
            <DocumentEditor
              ref={editorRef}
              id={`oo-editor-${documentType}-${documentId}`}
              documentServerUrl={ooUrl}
              config={editorConfig}
              events_onDocumentReady={onDocumentReady}
              events_onError={onError}
              events_onRequestSaveAs={onRequestSaveAs}
              height="100%"
              width="100%"
            />
          </div>
        )}

        </div>

        {/* Sidebar — review comments (admin + teacher) or AI assistant (teacher) */}
        {sidebarOpen && sidebarTab === 'comments' && showComments && (
          <CommentsSidebar
            lessonPlanId={documentId}
            onClose={() => setSidebarOpen(false)}
            onCountChange={setCommentCount}
          />
        )}
        {sidebarOpen && sidebarTab !== 'comments' && showChat && (
          <EditorChatSidebar
            plan={plan}
            title={title}
            onClose={() => setSidebarOpen(false)}
            onInsertIntoDocument={editorMode === 'edit' ? handleInsertIntoDocument : null}
            canInsertIntoDocument={insertBridgeReady && editorMode === 'edit'}
          />
        )}

      </div>
    </div>
  )
}
