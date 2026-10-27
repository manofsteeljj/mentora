import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Download, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react'
import { formatCourseLabel } from '../lib/courseDisplay'
import OnlyOfficeEditor from './OnlyOfficeEditor'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

export default function ExportSF1() {
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  // ONLYOFFICE editor state
  const [showOOEditor, setShowOOEditor] = useState(false)
  const [ooDocId, setOoDocId] = useState(null)
  const [ooDocTitle, setOoDocTitle] = useState('SF1 School Register')

  // School info (you can make this editable if needed)
  const [schoolInfo, setSchoolInfo] = useState({
    schoolName: 'Masupe Elementary School',
    schoolId: '',
    region: 'Region I',
    division: 'La Union',
    district: 'Balaoan',
    schoolYear: '2026 - 2027',
  })

  // Fetch courses
  useEffect(() => {
    fetch('/api/courses', {
      headers: {
        'Accept': 'application/json',
        'X-CSRF-TOKEN': getToken(),
      },
      credentials: 'same-origin',
    })
      .then((res) => {
        console.log('Courses API response status:', res.status)
        return res.ok ? res.json() : Promise.reject('Failed to load courses')
      })
      .then((data) => {
        console.log('Courses API data:', data)
        // API returns array directly, not { courses: [...] }
        const coursesArray = Array.isArray(data) ? data : (data.courses || [])
        setCourses(coursesArray)
        if (coursesArray.length > 0) {
          setSelectedCourse(String(coursesArray[0].id))
        } else {
          console.warn('No courses found in response')
        }
      })
      .catch((err) => {
        console.error('Failed to load courses:', err)
        setError('Failed to load courses. Please make sure you have courses created.')
      })
      .finally(() => setLoading(false))
  }, [])

  const selectedCourseInfo = courses.find((c) => String(c.id) === selectedCourse)

  // ─── Export SF1 (direct download) ─────────────────────────────────────────
  const handleExportSF1 = async () => {
    if (!selectedCourse) {
      alert('Please select a course first')
      return
    }

    setExporting(true)
    try {
      const params = new URLSearchParams({
        course_id: selectedCourse,
        school_name: schoolInfo.schoolName || '',
        school_id: schoolInfo.schoolId || '',
        region: schoolInfo.region || 'Region I',
        division: schoolInfo.division || 'La Union',
        district: schoolInfo.district || 'Balaoan',
        school_year: schoolInfo.schoolYear || '2026 - 2027',
      })

      const response = await fetch(`/api/gradebook/export-sf1?${params}`, {
        headers: {
          'Accept': 'application/vnd.ms-excel',
          'X-CSRF-TOKEN': getToken(),
        },
        credentials: 'same-origin',
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const courseName = selectedCourseInfo?.section || 'School_Register'
      a.download = `SF1_${schoolInfo.schoolYear.replace(/\s/g, '_')}_${courseName.replace(/[^A-Za-z0-9]/g, '_')}.xls`
      
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      alert('SF1 exported successfully!')
    } catch (error) {
      console.error('Export error:', error)
      alert(`Failed to export SF1: ${error.message}`)
    } finally {
      setExporting(false)
    }
  }

  // ─── Generate SF1 and open in ONLYOFFICE ──────────────────────────────────
  const handleOpenSF1InOnlyOffice = async () => {
    if (!selectedCourse) {
      alert('Please select a course first')
      return
    }

    setExporting(true)
    try {
      const res = await fetch('/api/documents/class-record-sf1/generate', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': getToken(),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          course_id: selectedCourse,
          school_name: schoolInfo.schoolName || '',
          school_id: schoolInfo.schoolId || '',
          region: schoolInfo.region || 'Region I',
          division: schoolInfo.division || 'La Union',
          district: schoolInfo.district || 'Balaoan',
          school_year: schoolInfo.schoolYear || '2026 - 2027',
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to generate SF1 document')
      }

      const data = await res.json()
      setOoDocId(data.id)
      setOoDocTitle(data.title || 'SF1 School Register')
      setShowOOEditor(true)
    } catch (error) {
      console.error('Open in ONLYOFFICE failed:', error)
      alert(`Could not open the SF1 report in ONLYOFFICE: ${error.message}`)
    } finally {
      setExporting(false)
    }
  }

  // Show ONLYOFFICE editor in full screen
  if (showOOEditor && ooDocId) {
    return (
      <OnlyOfficeEditor
        documentType="class-record"
        documentId={ooDocId}
        title={ooDocTitle}
        onBack={() => setShowOOEditor(false)}
        onSaved={() => {}}
        showChatSidebar={false}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-700" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Export SF1 - School Register</h1>
          <p className="text-sm text-gray-600 mt-1">
            Generate the official DepEd School Form 1 (SF1) School Register for your selected course
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* No Courses Warning */}
          {courses.length === 0 && !loading && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-900">
                    <p className="font-medium mb-1">No Courses Found</p>
                    <p className="text-yellow-800">
                      You need to create courses first before you can export SF1. Go to "My Courses" to create a course.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Course Selection Card */}
          {courses.length > 0 && (
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Select Course
              </CardTitle>
              <CardDescription>
                Choose the course for which you want to generate the SF1 School Register
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Course</label>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course">
                      {selectedCourseInfo ? formatCourseLabel(selectedCourseInfo) : 'Select a course'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={String(course.id)}>
                        {formatCourseLabel(course)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCourseInfo && (
                <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-900 font-medium mb-2">
                    Selected Course: {formatCourseLabel(selectedCourseInfo)}
                  </p>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>• The SF1 will include all registered students in this course</p>
                    <p>• Student information includes LRN, name, gender, birth date, address, parents/guardian, and contact details</p>
                    <p>• The report follows the exact official DepEd SF1 format</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* School Information Card (optional, for display only) */}
          {courses.length > 0 && (
            <Card>
            <CardHeader>
              <CardTitle>School Information</CardTitle>
              <CardDescription>
                This information will be included in the SF1 report
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">School Name</p>
                  <p className="font-medium">{schoolInfo.schoolName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Region</p>
                  <p className="font-medium">{schoolInfo.region}</p>
                </div>
                <div>
                  <p className="text-gray-600">Division</p>
                  <p className="font-medium">{schoolInfo.division}</p>
                </div>
                <div>
                  <p className="text-gray-600">District</p>
                  <p className="font-medium">{schoolInfo.district}</p>
                </div>
                <div>
                  <p className="text-gray-600">School Year</p>
                  <p className="font-medium">{schoolInfo.schoolYear}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Export Actions Card */}
          {courses.length > 0 && (
            <Card>
            <CardHeader>
              <CardTitle>Export Options</CardTitle>
              <CardDescription>
                Choose how you want to export the SF1 School Register
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4 border-blue-300 hover:bg-blue-50"
                onClick={handleOpenSF1InOnlyOffice}
                disabled={!selectedCourse || exporting}
              >
                <FileSpreadsheet className="w-5 h-5 text-blue-700" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-blue-900">Edit in ONLYOFFICE</p>
                  <p className="text-xs text-blue-700">
                    Open the SF1 in the spreadsheet editor to make changes before downloading
                  </p>
                </div>
              </Button>

              <Button
                className="w-full justify-start gap-3 h-auto py-4 bg-green-700 hover:bg-green-800"
                onClick={handleExportSF1}
                disabled={!selectedCourse || exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <div className="flex-1 text-left">
                      <p className="font-medium">Exporting...</p>
                      <p className="text-xs">Please wait while we generate your SF1 report</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <div className="flex-1 text-left">
                      <p className="font-medium">Download SF1</p>
                      <p className="text-xs">
                        Get an immediate Excel download of the SF1 School Register
                      </p>
                    </div>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
          )}

          {/* Info Card */}
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-purple-700 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-purple-900">
                  <p className="font-medium mb-1">About School Form 1 (SF1)</p>
                  <p className="text-purple-800">
                    The SF1 School Register is an official DepEd form that contains the complete
                    record of all learners enrolled in a specific grade level and section. It includes
                    student demographics, family background, and contact information.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
