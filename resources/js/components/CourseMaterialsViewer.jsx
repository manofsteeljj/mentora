import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import {
  ArrowLeft,
  FileText,
  Download,
  Upload,
  Search,
  Book,
  Video,
  FileImage,
  Link as LinkIcon,
  Trash2,
  Eye,
  Calendar,
  User,
  File,
} from 'lucide-react'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

function detectMaterialType(material) {
  const rawType = String(material?.type || '').toLowerCase()
  if (rawType.includes('pdf')) return 'pdf'
  if (rawType.includes('video')) return 'video'
  if (rawType.includes('image')) return 'image'
  if (rawType.includes('link')) return 'link'
  if (rawType.includes('word') || rawType.includes('document') || rawType.includes('excel') || rawType.includes('powerpoint')) return 'document'

  const title = String(material?.title || '').toLowerCase()
  if (title.endsWith('.pdf')) return 'pdf'
  if (title.endsWith('.mp4') || title.endsWith('.mov')) return 'video'
  if (title.endsWith('.png') || title.endsWith('.jpg') || title.endsWith('.jpeg') || title.endsWith('.gif')) return 'image'

  return 'document'
}

function getIcon(type) {
  switch (type) {
    case 'pdf':
    case 'document':
      return FileText
    case 'video':
      return Video
    case 'image':
      return FileImage
    case 'link':
      return LinkIcon
    default:
      return File
  }
}

function getTypeColor(type) {
  switch (type) {
    case 'pdf':
      return 'bg-red-100 text-red-700'
    case 'video':
      return 'bg-purple-100 text-purple-700'
    case 'image':
      return 'bg-blue-100 text-blue-700'
    case 'link':
      return 'bg-green-100 text-green-700'
    case 'document':
      return 'bg-yellow-100 text-yellow-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export default function CourseMaterialsViewer({ courseId, courseName, courseCode, onBack }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch('/api/materials', {
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const normalized = (Array.isArray(data) ? data : [])
          .filter((material) => String(material.course_id) === String(courseId))
          .map((material) => ({
            id: String(material.id),
            title: material.title || 'Untitled Material',
            type: detectMaterialType(material),
            uploadDate: material.uploaded_at || material.created_at || null,
            uploadedBy: material.uploaded_by || 'Faculty',
            size: material.size || null,
            topic: material.topic || 'General',
          }))
        setMaterials(normalized)
      })
      .catch(() => setMaterials([]))
      .finally(() => setLoading(false))
  }, [courseId])

  const filteredMaterials = useMemo(() => {
    return materials.filter((material) => {
      const matchesSearch =
        material.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.topic.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = filterType === 'all' || material.type === filterType
      return matchesSearch && matchesFilter
    })
  }, [materials, searchQuery, filterType])

  const handleDownload = (materialId) => {
    window.open(`/api/materials/${materialId}/download`, '_blank')
  }

  const handleDelete = async (materialId) => {
    if (!window.confirm('Are you sure you want to delete this material?')) return
    try {
      await fetch(`/api/materials/${materialId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
      })
      setMaterials((prev) => prev.filter((m) => m.id !== String(materialId)))
    } catch {
      // Keep UX simple for now; list remains unchanged on failure.
    }
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">{courseCode}</Badge>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
            </div>
            <h1 className="text-2xl font-semibold">{courseName}</h1>
            <p className="text-gray-500">Course Materials & Resources</p>
          </div>
          <Button className="bg-green-700 hover:bg-green-800" onClick={onBack}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Material
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search materials by title or topic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['all', 'pdf', 'video', 'link'].map((type) => (
                  <Button
                    key={type}
                    variant={filterType === type ? 'default' : 'outline'}
                    onClick={() => setFilterType(type)}
                    className={filterType === type ? 'bg-green-700 hover:bg-green-800' : ''}
                  >
                    {type === 'all' ? 'All' : type === 'pdf' ? 'PDFs' : type === 'video' ? 'Videos' : 'Links'}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Materials</p>
                  <p className="text-2xl font-bold">{materials.length}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Book className="w-6 h-6 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">PDFs</p>
                  <p className="text-2xl font-bold">{materials.filter((m) => m.type === 'pdf' || m.type === 'document').length}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-red-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Videos</p>
                  <p className="text-2xl font-bold">{materials.filter((m) => m.type === 'video').length}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Video className="w-6 h-6 text-purple-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Links</p>
                  <p className="text-2xl font-bold">{materials.filter((m) => m.type === 'link').length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <LinkIcon className="w-6 h-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">Loading materials...</CardContent>
            </Card>
          ) : filteredMaterials.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No materials found</p>
              </CardContent>
            </Card>
          ) : (
            filteredMaterials.map((material) => {
              const Icon = getIcon(material.type)
              return (
                <Card key={material.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 ${getTypeColor(material.type)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-6 h-6" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">{material.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{material.uploadDate ? new Date(material.uploadDate).toLocaleDateString() : 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>{material.uploadedBy}</span>
                              </div>
                              {material.size && <span>{material.size}</span>}
                            </div>
                          </div>
                          <Badge className={getTypeColor(material.type)}>{material.type.toUpperCase()}</Badge>
                        </div>

                        <div className="mb-3">
                          <Badge variant="outline" className="text-xs">
                            {material.topic}
                          </Badge>
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleDownload(material.id)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDownload(material.id)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(material.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
