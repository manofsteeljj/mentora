import { useEffect, useMemo, useState } from 'react'
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
  Building2,
  Phone,
  Calendar,
  ChevronDown,
  ChevronUp,
  GraduationCap,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

export default function AdminFaculty() {
  const [faculty, setFaculty] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments')
  const [selectedPosition, setSelectedPosition] = useState('All Positions')
  const [expandedFaculty, setExpandedFaculty] = useState(null)

  useEffect(() => {
    setLoading(true)

    fetch('/api/admin/faculty', {
      headers: {
        Accept: 'application/json',
        'X-CSRF-TOKEN': getToken(),
      },
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.message || 'Failed to load faculty members')
        }

        return response.json()
      })
      .then((data) => {
        setFaculty(Array.isArray(data?.faculty) ? data.faculty : [])
      })
      .catch((error) => {
        toast.error(error?.message || 'Unable to load faculty members')
        setFaculty([])
      })
      .finally(() => setLoading(false))
  }, [])

  const departments = useMemo(
    () => ['All Departments', ...Array.from(new Set(faculty.map((f) => f.department).filter(Boolean)))],
    [faculty]
  )

  const positions = useMemo(
    () => ['All Positions', ...Array.from(new Set(faculty.map((f) => f.position).filter(Boolean)))],
    [faculty]
  )

  const filteredFaculty = useMemo(
    () =>
      faculty.filter((member) => {
        const matchesSearch =
          searchQuery === '' ||
          String(member.name || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          String(member.employeeId || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          String(member.email || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          Array.isArray(member.courses)
            ? member.courses.some((c) => String(c || '').toLowerCase().includes(searchQuery.toLowerCase()))
            : false

        const matchesDepartment =
          selectedDepartment === 'All Departments' || member.department === selectedDepartment
        const matchesPosition = selectedPosition === 'All Positions' || member.position === selectedPosition

        return matchesSearch && matchesDepartment && matchesPosition
      }),
    [faculty, searchQuery, selectedDepartment, selectedPosition]
  )

  const handleExport = () => {
    const exportData = filteredFaculty.map((f) => ({
      'Employee ID': f.employeeId,
      Name: f.name,
      Email: f.email,
      Phone: f.phone,
      Department: f.department,
      Position: f.position,
      Courses: Array.isArray(f.courses) ? f.courses.join(', ') : '',
      'Total Students': f.totalStudents,
      'Join Date': f.joinDate,
      Status: f.status,
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Faculty Members')
    XLSX.writeFile(workbook, 'faculty_members.xlsx')
    toast.success('Faculty data exported successfully!')
  }

  const totalFaculty = faculty.length
  const activeFaculty = faculty.filter((f) => f.status === 'Active').length
  const totalCoursesManaged = faculty.reduce((sum, f) => sum + (Array.isArray(f.courses) ? f.courses.length : 0), 0)
  const totalStudentsServed = faculty.reduce((sum, f) => sum + (Number(f.totalStudents) || 0), 0)

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">Faculty Members</h1>
            <p className="text-gray-600">Complete directory of all faculty members</p>
          </div>
          <Button onClick={handleExport} className="bg-green-700 hover:bg-green-800" disabled={loading || filteredFaculty.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-blue-700" />
                Total Faculty
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{totalFaculty}</div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-green-700" />
                Active Faculty
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{activeFaculty}</div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-700" />
                Courses Managed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">{totalCoursesManaged}</div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-orange-700" />
                Students Served
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{totalStudentsServed}</div>
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
                  value={selectedPosition}
                  onChange={(e) => setSelectedPosition(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {positions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-gray-500">
                  <p>Loading faculty members...</p>
                </div>
              </CardContent>
            </Card>
          ) : filteredFaculty.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-gray-500">
                  <User className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No faculty members found matching your criteria.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredFaculty.map((member) => (
              <Card key={member.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-8 h-8 text-blue-700" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">{member.name}</h3>
                          <p className="text-sm text-gray-600">{member.employeeId}</p>
                          <Badge className="mt-1 bg-green-100 text-green-800">{member.position}</Badge>
                        </div>
                      </div>

                      <div className="ml-20 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{member.email}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{member.phone}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{member.department}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">
                            Joined{' '}
                            {member.joinDate
                              ? new Date(member.joinDate).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                })
                              : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {expandedFaculty === member.id && (
                        <div className="ml-20 mt-4 pt-4 border-t border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            Courses Teaching
                          </h4>
                          <div className="space-y-2">
                            {(member.courses || []).map((course, index) => (
                              <Badge key={`${member.id}-course-${index}`} variant="outline" className="mr-2">
                                {course}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-700">{member.totalStudents}</div>
                        <div className="text-xs text-gray-600">Students</div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-700">{(member.courses || []).length}</div>
                        <div className="text-xs text-gray-600">Courses</div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedFaculty(expandedFaculty === member.id ? null : member.id)}
                      >
                        {expandedFaculty === member.id ? (
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
