import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import {
  FileText,
  Search,
  Filter,
  Download,
  File,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  BookOpen,
  User,
  Calendar,
  HardDrive,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

function parseSizeToMb(fileSize) {
  const raw = String(fileSize || '').trim().toUpperCase()
  if (!raw) return 0

  const value = Number.parseFloat(raw)
  if (Number.isNaN(value)) return 0

  if (raw.includes('GB')) return value * 1024
  if (raw.includes('MB')) return value
  if (raw.includes('KB')) return value / 1024

  return 0
}

export default function AdminMaterials() {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFileType, setSelectedFileType] = useState('All Types')
  const [selectedCategory, setSelectedCategory] = useState('All Categories')

  useEffect(() => {
    setLoading(true)

    fetch('/api/admin/materials', {
      headers: {
        Accept: 'application/json',
        'X-CSRF-TOKEN': getToken(),
      },
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.message || 'Failed to load materials')
        }

        return response.json()
      })
      .then((data) => {
        setMaterials(Array.isArray(data?.materials) ? data.materials : [])
      })
      .catch((error) => {
        toast.error(error?.message || 'Unable to load materials')
        setMaterials([])
      })
      .finally(() => setLoading(false))
  }, [])

  const fileTypes = useMemo(
    () => ['All Types', ...Array.from(new Set(materials.map((m) => m.fileType).filter(Boolean)))],
    [materials]
  )

  const categories = useMemo(
    () => ['All Categories', ...Array.from(new Set(materials.map((m) => m.category).filter(Boolean)))],
    [materials]
  )

  const filteredMaterials = useMemo(
    () =>
      materials.filter((material) => {
        const matchesSearch =
          searchQuery === '' ||
          String(material.fileName || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          String(material.course || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          String(material.courseCode || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          String(material.uploadedBy || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase())

        const matchesFileType = selectedFileType === 'All Types' || material.fileType === selectedFileType
        const matchesCategory = selectedCategory === 'All Categories' || material.category === selectedCategory

        return matchesSearch && matchesFileType && matchesCategory
      }),
    [materials, searchQuery, selectedFileType, selectedCategory]
  )

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'PDF':
      case 'DOCX':
        return FileText
      case 'XLSX':
        return FileSpreadsheet
      case 'Image':
        return FileImage
      case 'Video':
        return FileVideo
      default:
        return File
    }
  }

  const getFileColor = (fileType) => {
    switch (fileType) {
      case 'PDF':
        return 'text-red-600 bg-red-100'
      case 'DOCX':
        return 'text-blue-600 bg-blue-100'
      case 'PPTX':
        return 'text-orange-600 bg-orange-100'
      case 'XLSX':
        return 'text-green-600 bg-green-100'
      case 'Image':
        return 'text-purple-600 bg-purple-100'
      case 'Video':
        return 'text-pink-600 bg-pink-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const handleExport = () => {
    const exportData = filteredMaterials.map((m) => ({
      'File Name': m.fileName,
      'File Type': m.fileType,
      'File Size': m.fileSize,
      Course: m.course,
      'Course Code': m.courseCode,
      'Uploaded By': m.uploadedBy,
      'Upload Date': m.uploadDate,
      Category: m.category,
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Materials Library')
    XLSX.writeFile(workbook, 'materials_library.xlsx')
    toast.success('Materials data exported successfully!')
  }

  const totalMaterials = materials.length
  const totalSize = materials.reduce((sum, m) => sum + parseSizeToMb(m.fileSize), 0)
  const categoryCount = Array.from(new Set(materials.map((m) => m.category).filter(Boolean))).length
  const fileTypeCount = Array.from(new Set(materials.map((m) => m.fileType).filter(Boolean))).length

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">Materials Library</h1>
            <p className="text-gray-600">Complete repository of all uploaded course materials</p>
          </div>
          <Button onClick={handleExport} className="bg-green-700 hover:bg-green-800" disabled={loading || filteredMaterials.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-700" />
                Total Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{totalMaterials}</div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-purple-700" />
                Total Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">{totalSize.toFixed(1)} MB</div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-700" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{categoryCount}</div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <File className="w-4 h-4 text-green-700" />
                File Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{fileTypeCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by filename, course, or instructor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedFileType}
                  onChange={(e) => setSelectedFileType(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {fileTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-12 text-gray-500">
                  <p>Loading materials...</p>
                </div>
              ) : filteredMaterials.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No materials found matching your criteria.</p>
                </div>
              ) : (
                filteredMaterials.map((material) => {
                  const FileIcon = getFileIcon(material.fileType)
                  const fileColor = getFileColor(material.fileType)

                  return (
                    <div
                      key={material.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:bg-green-50/30 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${fileColor}`}>
                            <FileIcon className="w-6 h-6" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1">{material.fileName}</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-gray-400" />
                                <span>{material.courseCode} - {material.course}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span>{material.uploadedBy}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span>
                                  {material.uploadDate
                                    ? new Date(material.uploadDate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                      })
                                    : 'N/A'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-gray-400" />
                                <span>{material.fileSize}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Badge className="bg-purple-100 text-purple-800">{material.category}</Badge>
                          <Badge variant="outline">{material.fileType}</Badge>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
