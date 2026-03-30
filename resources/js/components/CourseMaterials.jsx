import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Upload, FileText, File, Download, Trash2, Eye, Loader2, X } from 'lucide-react'
import { formatCourseLabel } from '../lib/courseDisplay'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

function getFileIcon(type) {
  if (type === 'PDF') return <FileText className="w-5 h-5 text-red-500" />
  if (type === 'PowerPoint') return <File className="w-5 h-5 text-orange-500" />
  if (type === 'Word') return <File className="w-5 h-5 text-blue-500" />
  if (type === 'Excel') return <File className="w-5 h-5 text-green-600" />
  return <File className="w-5 h-5 text-gray-500" />
}

export default function CourseMaterials() {
  const [materials, setMaterials] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCourseId, setUploadCourseId] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadError, setUploadError] = useState('')

  const fetchMaterials = () => {
    fetch('/api/materials', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setMaterials(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const fetchCourses = () => {
    fetch('/api/courses', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCourses(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  useEffect(() => {
    fetchMaterials()
    fetchCourses()
  }, [])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!uploadFile || !uploadTitle.trim() || !uploadCourseId) {
      setUploadError('Please fill in all fields and select a file.')
      return
    }

    setUploading(true)
    setUploadError('')

    const formData = new FormData()
    formData.append('title', uploadTitle.trim())
    formData.append('course_id', uploadCourseId)
    formData.append('file', uploadFile)

    try {
      const resp = await fetch('/api/materials', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-TOKEN': getToken(),
        },
        credentials: 'same-origin',
        body: formData,
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.message || `Upload failed (${resp.status})`)
      }

      setShowUploadModal(false)
      setUploadTitle('')
      setUploadCourseId('')
      setUploadFile(null)
      fetchMaterials()
    } catch (err) {
      setUploadError(err.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this material?')) return

    try {
      await fetch(`/api/materials/${id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
      })
      fetchMaterials()
    } catch {}
  }

  const handleDownload = (id) => {
    window.open(`/api/materials/${id}/download`, '_blank')
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Course Materials</h1>
            <p className="text-gray-500">Manage and access learning resources</p>
          </div>
          <Button
            onClick={() => setShowUploadModal(true)}
            className="bg-green-700 hover:bg-green-800"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Material
          </Button>
        </div>

        {/* Materials List */}
        <Card>
          <CardHeader>
            <CardTitle>Available Materials</CardTitle>
            <CardDescription>
              These materials are used as context for AI responses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading materials...</span>
              </div>
            ) : materials.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No materials uploaded yet</p>
                <p className="text-sm text-gray-400 mt-1">Upload your first course material to get started</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {materials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(material.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{material.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          {material.size && <span>{material.size}</span>}
                          {material.size && <span>•</span>}
                          <Badge variant="outline" className="text-xs">
                            {material.course_name}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Uploaded on {material.uploaded_at}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(material.id)} title="View / Download">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(material.id)} title="Download">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(material.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Drag & Drop area */}
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="font-medium mb-2">Upload Course Materials</h3>
            <p className="text-sm text-gray-500 mb-4 text-center">
              Support for PDF, PPTX, DOCX files
              <br />
              Maximum file size: 10MB
            </p>
            <Button onClick={() => setShowUploadModal(true)} variant="outline">
              Choose Files
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Upload Material</h3>
              <button
                onClick={() => { setShowUploadModal(false); setUploadError('') }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-4 space-y-4">
              {uploadError && (
                <div className="p-3 text-sm text-red-700 bg-red-50 rounded-md border border-red-200">
                  {uploadError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  placeholder="e.g. OSPF Configuration Guide"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select
                  value={uploadCourseId}
                  onChange={(e) => setUploadCourseId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  required
                >
                  <option value="">Select a course...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatCourseLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                <input
                  type="file"
                  accept=".pdf,.pptx,.ppt,.docx,.doc,.xlsx,.xls,.txt"
                  onChange={(e) => setUploadFile(e.target.files[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">PDF, PPTX, DOCX, XLSX, TXT — Max 10MB</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowUploadModal(false); setUploadError('') }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-green-700 hover:bg-green-800"
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
