import { useEffect, useRef, useState } from 'react'
import { DocumentEditor } from '@onlyoffice/document-editor-react'
import { Loader2, AlertTriangle, ArrowLeft, FileText } from 'lucide-react'
import { Button } from './ui/button'

function csrf() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

/**
 * OnlyOfficeEditor
 *
 * Fetches the editor config from Laravel, then renders the ONLYOFFICE
 * DocumentEditor component inside the Mentora UI.
 *
 * Props:
 *   documentType  — 'lesson-plan' | 'class-record'
 *   documentId    — numeric ID
 *   title         — display title (optional, shown in header)
 *   onBack        — callback when user clicks Back
 *   onSaved       — callback when ONLYOFFICE reports a successful save
 */
export default function OnlyOfficeEditor({
  documentType = 'lesson-plan',
  documentId,
  title = 'Document',
  onBack,
  onSaved,
}) {
  const [state, setState] = useState('loading')   // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('')
  const [editorConfig, setEditorConfig] = useState(null)
  const [ooUrl, setOoUrl] = useState('')
  const editorRef = useRef(null)

  // ── Fetch editor config from Laravel ──────────────────────────────────────
  useEffect(() => {
    if (!documentId) return

    setState('loading')
    setErrorMsg('')

    fetch(`/api/documents/${documentType}/${documentId}/editor`, {
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
  }, [documentType, documentId])

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
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded ml-1">
              Editing in ONLYOFFICE
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400 flex-shrink-0">
          Changes save automatically via ONLYOFFICE
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">

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
    </div>
  )
}
