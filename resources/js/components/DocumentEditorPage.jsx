import { useEffect, useRef, useState } from 'react'
import { Download, FileText, FolderOpen, Loader2, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import OnlyOfficeEditor from './OnlyOfficeEditor'

const templates = [
  { kind: 'sf1', label: 'SF1', description: 'School register template' },
  { kind: 'sf2', label: 'SF2', description: 'Daily attendance template' },
  { kind: 'class-record', label: 'Class Record', description: 'Editable class record template' },
]

function csrf() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function DocumentEditorPage() {
  const [documents, setDocuments] = useState([])
  const [activeDocument, setActiveDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const fileInput = useRef(null)

  const loadDocuments = () => {
    fetch('/api/documents/personal', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load your documents.')
        return response.json()
      })
      .then(setDocuments)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  async function createTemplate(kind) {
    setBusy(kind)
    try {
      const response = await fetch('/api/documents/personal/template', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
        body: JSON.stringify({ kind }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to create the template.')
      setDocuments((current) => [data, ...current])
      setActiveDocument(data)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy('')
    }
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBusy('upload')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const response = await fetch('/api/documents/personal/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to upload the document.')
      setDocuments((current) => [data, ...current])
      setActiveDocument(data)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy('')
    }
  }

  if (activeDocument) {
    return (
      <OnlyOfficeEditor
        documentType="personal"
        documentId={activeDocument.id}
        title={activeDocument.title}
        onBack={() => {
          loadDocuments()
          setActiveDocument(null)
        }}
      />
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Document Editor</h1>
            <p className="text-gray-500">Edit, save, and download your documents in ONLYOFFICE.</p>
          </div>
          <Button onClick={() => fileInput.current?.click()} disabled={busy === 'upload'} className="bg-green-700 hover:bg-green-800">
            {busy === 'upload' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload File
          </Button>
          <input ref={fileInput} type="file" accept=".docx,.xlsx,.xls,.pptx" className="hidden" onChange={uploadFile} />
        </div>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Plus className="h-4 w-4 text-green-700" />Start from a template</h2>
          <p className="mb-4 text-sm text-gray-500">Choose a form, then edit it online and save it from the web.</p>
          <div className="grid gap-3 md:grid-cols-3">
            {templates.map((template) => (
              <button key={template.kind} type="button" onClick={() => createTemplate(template.kind)} disabled={busy === template.kind} className="rounded-lg border p-4 text-left transition hover:border-green-600 hover:bg-green-50 disabled:opacity-60">
                <FileText className="mb-3 h-6 w-6 text-green-700" />
                <span className="block font-medium">{busy === template.kind ? 'Creating...' : template.label}</span>
                <span className="text-sm text-gray-500">{template.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><FolderOpen className="h-4 w-4 text-green-700" />Saved Documents</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading documents...</div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-gray-500">No documents yet. Upload a file or choose a template above.</p>
          ) : (
            <div className="divide-y">
              {documents.map((document) => (
                <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <button type="button" onClick={() => setActiveDocument(document)} className="flex min-w-0 items-center gap-3 text-left hover:text-green-700">
                    <FileText className="h-5 w-5 shrink-0 text-gray-400" />
                    <span className="truncate font-medium">{document.title}</span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs uppercase text-gray-500">{document.extension}</span>
                  </button>
                  <a href={`/api/documents/personal/${document.id}/download`} className="inline-flex items-center text-sm text-green-700 hover:underline">
                    <Download className="mr-1 h-4 w-4" />Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
