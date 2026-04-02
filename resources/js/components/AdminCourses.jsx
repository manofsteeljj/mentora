import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import {
  BookOpen,
  Search,
  Filter,
  Download,
  Users,
  FileText,
  User,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function AdminCourses() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [expandedCourse, setExpandedCourse] = useState(null)

  useEffect(() => {
    setLoading(true)

    fetch('/api/admin/courses', {
      headers: {
        Accept: 'application/json',
        'X-CSRF-TOKEN': getToken(),
      },
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.message || 'Failed to load courses')
        }
        return response.json()
      })
      .then((data) => {
        setCourses(Array.isArray(data?.courses) ? data.courses : [])
      })
      .catch((error) => {
        toast.error(error?.message || 'Unable to load courses')
        setCourses([])
      })
      .finally(() => setLoading(false))
  }, [])

  const departments = useMemo(
    () => ['All Departments', ...Array.from(new Set(courses.map((c) => c.department).filter(Boolean)))],
    [courses]
  )

  const filteredCourses = useMemo(
    () =>
      courses.filter((course) => {
        const matchesSearch =
          searchQuery === '' ||
          String(course.name || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          String(course.code || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          String(course.instructor || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase())

        const matchesDepartment =
          selectedDepartment === 'All Departments' || course.department === selectedDepartment
        const matchesStatus = selectedStatus === 'All' || course.status === selectedStatus

        return matchesSearch && matchesDepartment && matchesStatus
      }),
    [courses, searchQuery, selectedDepartment, selectedStatus]
  )

  const handleExport = () => {
    const exportData = filteredCourses.map((c) => ({
      'Course Code': c.code,
      'Course Name': c.name,
      Department: c.department,
      Instructor: c.instructor,
      Section: c.section,
      Students: c.students,
      Materials: c.materials,
      Semester: c.semester,
      Status: c.status,
      'Start Date': c.startDate,
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Courses')
    XLSX.writeFile(workbook, 'all_courses.xlsx')
    toast.success('Course data exported successfully!')
  }

  const totalCourses = courses.length
  const activeCourses = courses.filter((c) => c.status === 'Active').length
  const totalStudents = courses.reduce((sum, c) => sum + (Number(c.students) || 0), 0)
  const totalMaterials = courses.reduce((sum, c) => sum + (Number(c.materials) || 0), 0)

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">All Courses</h1>
            <p className="text-gray-600">Complete catalog of all courses in the system</p>
          </div>
          <Button onClick={handleExport} className="bg-green-700 hover:bg-green-800" disabled={loading || filteredCourses.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-purple-200 bg-purple-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-700" />
                Total Courses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">{totalCourses}</div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-green-700" />
                Active Courses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{activeCourses}</div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-700" />
                Total Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{totalStudents}</div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-700" />
                Total Materials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{totalMaterials}</div>
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
                  placeholder="Search by name, code, or instructor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loading ? (
            <Card className="lg:col-span-2">
              <CardContent className="pt-6">
                <div className="text-center py-12 text-gray-500">
                  <p>Loading courses...</p>
                </div>
              </CardContent>
            </Card>
          ) : filteredCourses.length === 0 ? (
            <Card className="lg:col-span-2">
              <CardContent className="pt-6">
                <div className="text-center py-12 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No courses found matching your criteria.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredCourses.map((course) => (
              <Card key={course.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                          <BookOpen className="w-6 h-6 text-purple-700" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{course.name}</CardTitle>
                          <p className="text-sm text-gray-600">{course.code} - {course.section}</p>
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={
                        course.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : course.status === 'Completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                      }
                    >
                      {course.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Instructor:</span>
                      <span className="font-medium text-gray-900">{course.instructor}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Department:</span>
                      <span className="font-medium text-gray-900">{course.department}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <Users className="w-4 h-4 text-blue-700 mx-auto mb-1" />
                        <div className="text-xl font-bold text-blue-700">{course.students}</div>
                        <div className="text-xs text-gray-600">Students</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <FileText className="w-4 h-4 text-orange-700 mx-auto mb-1" />
                        <div className="text-xl font-bold text-orange-700">{course.materials}</div>
                        <div className="text-xs text-gray-600">Materials</div>
                      </div>
                    </div>

                    {expandedCourse === course.id && (
                      <div className="pt-3 border-t border-gray-200 space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">Semester:</span>
                          <span className="font-medium">{course.semester}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">Start Date:</span>
                          <span className="font-medium">
                            {course.startDate
                              ? new Date(course.startDate).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
                    >
                      {expandedCourse === course.id ? (
                        <>
                          <ChevronUp className="w-4 h-4 mr-2" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 mr-2" />
                          Show More
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
