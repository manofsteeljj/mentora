import { useMemo, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import {
  User,
  Search,
  Filter,
  Download,
  Mail,
  BookOpen,
  GraduationCap,
  Building2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function AdminStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [expandedStudent, setExpandedStudent] = useState(null)

  useEffect(() => {
    setLoading(true)

    fetch('/api/admin/students', {
      headers: {
        Accept: 'application/json',
        'X-CSRF-TOKEN': getToken(),
      },
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.message || 'Failed to load students')
        }
        return response.json()
      })
      .then((data) => {
        setStudents(Array.isArray(data?.students) ? data.students : [])
      })
      .catch((error) => {
        toast.error(error?.message || 'Unable to load students')
        setStudents([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const departments = useMemo(
    () => ['All Departments', ...Array.from(new Set(students.map((s) => s.department).filter(Boolean)))],
    [students]
  )

  const filteredStudents = useMemo(
    () =>
      students.filter((student) => {
        const matchesSearch =
          searchQuery === '' ||
          String(student.name || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          String(student.studentId || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          String(student.email || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          String(student.course || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase())

        const matchesDepartment =
          selectedDepartment === 'All Departments' || student.department === selectedDepartment
        const matchesStatus = selectedStatus === 'All' || student.status === selectedStatus

        return matchesSearch && matchesDepartment && matchesStatus
      }),
    [students, searchQuery, selectedDepartment, selectedStatus]
  )

  const handleExport = () => {
    const exportData = filteredStudents.map((s) => ({
      'Student ID': s.studentId,
      Name: s.name,
      Email: s.email,
      Course: s.course,
      Section: s.section,
      Department: s.department,
      'Enrollment Date': s.enrollmentDate,
      Status: s.status,
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Students')
    XLSX.writeFile(workbook, 'all_students.xlsx')
    toast.success('Student data exported successfully!')
  }

  const totalStudents = students.length
  const activeStudents = students.filter((s) => s.status === 'Active').length
  const departmentCounts = Array.from(new Set(students.map((s) => s.department).filter(Boolean))).map((dept) => ({
    name: dept,
    count: students.filter((s) => s.department === dept).length,
  }))

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">All Students</h1>
            <p className="text-gray-600">Complete database of all enrolled students</p>
          </div>
          <Button onClick={handleExport} className="bg-green-700 hover:bg-green-800" disabled={loading || filteredStudents.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-green-700" />
                Total Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{totalStudents}</div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-blue-700" />
                Active Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{activeStudents}</div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-700" />
                Departments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">{departmentCounts.length}</div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-orange-700" />
                Showing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{filteredStudents.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, ID, email, or course..."
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
                  <p>Loading students...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <User className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No students found matching your criteria.</p>
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:bg-green-50/30 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-green-700" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{student.name}</h3>
                            <p className="text-sm text-gray-600">{student.studentId}</p>
                          </div>
                        </div>

                        <div className="ml-12 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">{student.email || 'No email'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">{student.course}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">{student.department}</span>
                          </div>
                        </div>

                        {expandedStudent === student.id && (
                          <div className="ml-12 mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-600">Section:</span>
                              <span className="ml-2 font-medium">{student.section}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Enrolled:</span>
                              <span className="ml-2 font-medium">
                                {student.enrollmentDate
                                  ? new Date(student.enrollmentDate).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                    })
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge
                          className={
                            student.status === 'Active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {student.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedStudent(expandedStudent === student.id ? null : student.id)}
                        >
                          {expandedStudent === student.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
